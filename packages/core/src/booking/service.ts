import { prisma, Prisma, type Booking, type BookingStatus, type Db, type PrismaClient } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { can } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, invalid, notFound } from '../errors';
import { generateAccessToken, generateReference, REFERENCE_PREFIX, verifyToken } from '../ids';
import { getEnv } from '../env';
import { getSetting } from '../settings';
import { addDays, compareLocalDates, hhmmToMinutes, parseLocalDate, todayIn, utcToZoned, zonedToUtc, type LocalDate } from '../time';
import { createBookingSchema, rescheduleSchema, type CreateBookingInput } from '../schemas';
import { quoteService } from '../pricing/service';
import type { PriceBreakdown } from '../pricing/engine';
import { expireStaleHolds, loadAvailabilityContext } from '../availability/service';
import { windowFitsResource } from '../availability/engine';
import { resolveCustomer } from '../customers/service';
import { ACTIVE_BOOKING_STATUSES, canTransition, isActiveStatus, type BookingStatusValue, type TransitionActor } from './status';

export const TX_OPTIONS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000, maxWait: 10_000 };

export type Tx = Prisma.TransactionClient;

/** Run `fn` in the caller's transaction if there is one, otherwise open a new one. */
export async function withTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if ('$transaction' in db) return (db as PrismaClient).$transaction(fn, TX_OPTIONS);
  return fn(db as Tx);
}

/** Serialise concurrent writers per resource for the rest of the transaction. */
async function lockResources(tx: Tx, resourceIds: string[]) {
  for (const id of [...new Set(resourceIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'resource:' + id}))`;
  }
}

async function lockBooking(tx: Tx, bookingId: string) {
  await tx.$executeRaw`SELECT 1 FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
}

export function isOverlapViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('booking_no_resource_overlap') || msg.includes('23P01');
}

export function formatWhen(start: Date, tz: string, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start);
}

interface SlotCheckParams {
  serviceId: string;
  locationId: string;
  durationMin: number;
  date: LocalDate;
  startMinute: number;
  now: Date;
  excludeBookingId?: string;
  preferredResourceId?: string | null;
}

/**
 * Re-verify a specific slot inside a transaction after locking the candidate
 * resources. Returns the resource to reserve (or null when the service does
 * not use exclusive resources).
 */
export async function reserveSlot(tx: Tx, p: SlotCheckParams) {
  const location = await tx.location.findUniqueOrThrow({ where: { id: p.locationId } });
  const start = zonedToUtc(p.date, p.startMinute, location.timezone);
  const from = new Date(start.getTime() - 86_400_000);
  const to = new Date(start.getTime() + (p.durationMin + 24 * 60) * 60_000);

  const candidateIds = (
    await tx.resource.findMany({
      where: { locationId: p.locationId, isActive: true, isExclusive: true, services: { some: { serviceId: p.serviceId } } },
      select: { id: true },
    })
  ).map((r) => r.id);
  await lockResources(tx, candidateIds);

  const ctx = await loadAvailabilityContext(
    { serviceId: p.serviceId, locationId: p.locationId, durationMin: p.durationMin, from, to, excludeBookingId: p.excludeBookingId, now: p.now },
    tx,
  );
  if (start < ctx.rules.earliestStart) {
    throw invalid('That start time is too soon. Please choose a later time.');
  }

  const fitsHoursOnly = (resource: (typeof ctx.resources)[number] | null) =>
    windowFitsResource(p.date, p.startMinute, ctx.rules, ctx.locationHours, [], resource ? { ...resource, busy: [] } : null);

  if (!ctx.service.requiresResource) {
    if (!fitsHoursOnly(null)) throw invalid('The selected time is outside opening hours.');
    if (!windowFitsResource(p.date, p.startMinute, ctx.rules, ctx.locationHours, ctx.locationBlocks, null)) {
      throw new DomainError('UNAVAILABLE', 'The selected time is unavailable. Please choose another slot.');
    }
    return { ctx, resourceId: null as string | null, start };
  }

  const ordered = [...ctx.resources].sort((a, b) =>
    a.id === p.preferredResourceId ? -1 : b.id === p.preferredResourceId ? 1 : 0,
  );
  if (!ordered.some((r) => fitsHoursOnly(r))) throw invalid('The selected time is outside opening hours.');
  const chosen = ordered.find((r) => windowFitsResource(p.date, p.startMinute, ctx.rules, ctx.locationHours, ctx.locationBlocks, r));
  if (!chosen) {
    throw new DomainError('UNAVAILABLE', 'Sorry, that time has just been taken or is unavailable. Please choose another slot.');
  }
  return { ctx, resourceId: chosen.id, start };
}

function validateBookingDate(date: LocalDate, tz: string, maxAdvanceDays: number, now: Date) {
  const today = todayIn(tz, now);
  if (compareLocalDates(date, today) < 0) throw invalid('The selected date is in the past.');
  if (compareLocalDates(date, addDays(today, maxAdvanceDays)) > 0) {
    throw invalid(`Bookings can be made up to ${maxAdvanceDays} days in advance.`);
  }
}

function bookingItemsFromBreakdown(breakdown: PriceBreakdown) {
  return breakdown.lines.map((l, i) => ({
    kind: l.kind,
    refId: l.refId,
    description: l.description,
    quantity: l.quantity,
    unitPriceMinor: l.unitPriceMinor,
    totalMinor: l.totalMinor,
    sortOrder: i,
  }));
}

export interface CreateBookingResult {
  booking: Booking;
  /** Plain guest access token. Returned once; only its hash is stored. */
  accessToken: string;
}

export async function createBooking(
  raw: unknown,
  actor: Actor | null,
  ctx: RequestContext = {},
  opts: { now?: Date; db?: PrismaClient; isDemo?: boolean; sourceSite?: 'STUDIO' | null } = {},
): Promise<CreateBookingResult> {
  const db = opts.db ?? prisma;
  const now = opts.now ?? new Date();
  const input: CreateBookingInput = createBookingSchema.parse(raw);
  const rules = await getSetting('bookingRules', db);
  if (!actor && !rules.allowGuestBookings) throw new DomainError('UNAUTHENTICATED', 'Please sign in to book.');

  const date = parseLocalDate(input.date);
  if (!date) throw invalid('Date must be a valid calendar date.');
  const startMinute = hhmmToMinutes(input.startTime);
  if (startMinute === null) throw invalid('Start time must be in HH:MM format.');

  const location = await db.location.findUnique({ where: { id: input.locationId } });
  if (!location || !location.isActive || !location.brands.includes(input.brand)) throw notFound('Location');

  const quote = await quoteService(
    { serviceId: input.serviceId, packageId: input.packageId, addOnIds: input.addOnIds, durationMin: input.durationMin, locationId: location.id },
    db,
  );
  if (quote.service.brand !== input.brand) throw notFound('Service');
  validateBookingDate(date, location.timezone, rules.maxAdvanceDays, now);

  await expireStaleHolds(db, now);
  const payments = getEnv().PAYMENTS_MODE;
  const { breakdown } = quote;
  const needsPayment = breakdown.totalMinor > 0 && breakdown.depositMinor > 0 && payments !== 'disabled';

  let initialStatus: BookingStatus;
  if (quote.service.bookingMode === 'REQUEST') initialStatus = 'ENQUIRY_SUBMITTED';
  else initialStatus = needsPayment ? 'AWAITING_PAYMENT' : 'AWAITING_REVIEW';

  const access = generateAccessToken();
  const reference = generateReference(REFERENCE_PREFIX[input.brand]);

  try {
    const booking = await db.$transaction(async (tx) => {
      const { resourceId, start } = await reserveSlot(tx, {
        serviceId: quote.service.id,
        locationId: location.id,
        durationMin: quote.durationMin,
        date,
        startMinute,
        now,
      });
      const end = new Date(start.getTime() + quote.durationMin * 60_000);
      const customer = await resolveCustomer(actor, input.contact, tx);
      if (rules.maxActiveBookingsPerCustomer > 0) {
        const active = await tx.booking.count({
          where: { customerId: customer.id, status: { in: [...ACTIVE_BOOKING_STATUSES] }, endsAt: { gt: now } },
        });
        if (active >= rules.maxActiveBookingsPerCustomer) {
          throw new DomainError('CONFLICT', `You already have ${active} upcoming bookings. Please contact the team to book more sessions.`);
        }
      }

      return tx.booking.create({
        data: {
          reference,
          accessTokenHash: access.hash,
          brand: input.brand,
          sourceSite: input.sourceSite ?? opts.sourceSite ?? null,
          customerId: customer.id,
          serviceId: quote.service.id,
          packageId: quote.pkg?.id ?? null,
          locationId: location.id,
          resourceId,
          startsAt: start,
          endsAt: end,
          blockedFrom: start,
          blockedUntil: new Date(end.getTime() + quote.service.bufferMin * 60_000),
          timezone: location.timezone,
          durationMin: quote.durationMin,
          attendees: input.attendees ?? null,
          status: initialStatus,
          paymentStatus: breakdown.totalMinor === 0 ? 'NOT_REQUIRED' : 'UNPAID',
          currency: breakdown.currency,
          subtotalMinor: breakdown.subtotalMinor,
          discountMinor: breakdown.discountMinor,
          feesMinor: breakdown.feesMinor,
          taxMinor: breakdown.taxMinor,
          totalMinor: breakdown.totalMinor,
          depositMinor: breakdown.depositMinor,
          priceBreakdown: breakdown as unknown as Prisma.InputJsonValue,
          pricingVersion: breakdown.pricingVersion,
          holdExpiresAt: initialStatus === 'AWAITING_PAYMENT' ? new Date(now.getTime() + rules.holdMinutes * 60_000) : null,
          contactName: input.contact.name,
          contactEmail: input.contact.email,
          contactPhone: input.contact.phone ?? null,
          customerNotes: input.notes || null,
          isDemo: opts.isDemo ?? false,
          items: { create: bookingItemsFromBreakdown(breakdown) },
          history: {
            create: {
              fromStatus: null,
              toStatus: initialStatus,
              actorType: 'CUSTOMER',
              actorUserId: actor?.userId ?? null,
              reason: 'Booking submitted from website',
            },
          },
        },
      });
    }, TX_OPTIONS);

    await recordAudit(actor, { action: 'booking.created', entityType: 'Booking', entityId: booking.id, summary: `${reference} created (${initialStatus})` }, ctx, db);
    return { booking, accessToken: access.token };
  } catch (err) {
    if (isOverlapViolation(err)) {
      throw new DomainError('UNAVAILABLE', 'Sorry, that time has just been taken. Please choose another slot.');
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

export interface Viewer {
  actor: Actor | null;
  accessToken?: string | null;
}

/** Load a booking only if the viewer may see it. Unauthorised and missing look identical. */
export async function getBookingForViewer(reference: string, viewer: Viewer, db: Db = prisma) {
  const booking = await db.booking.findUnique({
    where: { reference: reference.toUpperCase() },
    include: {
      service: true,
      package: true,
      location: true,
      items: { orderBy: { sortOrder: 'asc' } },
      history: { orderBy: { createdAt: 'asc' } },
      paymentOrders: { orderBy: { createdAt: 'desc' } },
      transactions: { orderBy: { createdAt: 'desc' } },
      customer: true,
      rescheduleRequests: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!booking) throw notFound('Booking');
  if (!(await viewerCanAccess(booking, viewer))) throw notFound('Booking');
  return booking;
}

export async function viewerCanAccess(
  booking: { customerId: string; accessTokenHash: string | null },
  viewer: Viewer,
): Promise<boolean> {
  if (viewer.actor && can(viewer.actor, 'bookings.read')) return true;
  if (viewer.actor) {
    const profile = await prisma.customerProfile.findUnique({ where: { userId: viewer.actor.userId }, select: { id: true } });
    if (profile && profile.id === booking.customerId) return true;
  }
  return verifyToken(viewer.accessToken, booking.accessTokenHash);
}

/**
 * Reference + email lookup for the public status page. Returns a minimal,
 * non-sensitive summary (no address, phone, notes or payment details).
 */
export async function lookupBookingStatus(reference: string, email: string, db: Db = prisma) {
  const booking = await db.booking.findUnique({
    where: { reference: reference.toUpperCase() },
    include: { service: { select: { name: true } } },
  });
  if (!booking || booking.contactEmail.toLowerCase() !== email.trim().toLowerCase()) throw notFound('Booking');
  return {
    reference: booking.reference,
    brand: booking.brand,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    serviceName: booking.service.name,
    startsAt: booking.startsAt.toISOString(),
    timezone: booking.timezone,
    isDemo: booking.isDemo,
  };
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export interface TransitionParams {
  bookingId: string;
  to: BookingStatusValue;
  actorType: TransitionActor;
  actor?: Actor | null;
  reason?: string | null;
  now?: Date;
}

export async function transitionBooking(p: TransitionParams, db: Db = prisma, ctx: RequestContext = {}): Promise<Booking> {
  const now = p.now ?? new Date();
  const rules = await getSetting('bookingRules', db);
  return withTx(db, async (tx) => {
    await lockBooking(tx, p.bookingId);
    const booking = await tx.booking.findUnique({ where: { id: p.bookingId } });
    if (!booking) throw notFound('Booking');
    const from = booking.status as BookingStatusValue;
    if (!canTransition(from, p.to, p.actorType)) {
      throw new DomainError('INVALID_TRANSITION', `A booking cannot move from ${from} to ${p.to}.`);
    }
    const reason = p.reason?.trim() || null;

    if (p.to === 'CONFIRMED') {
      const paymentSatisfied = booking.depositMinor === 0 || booking.amountPaidMinor >= booking.depositMinor;
      if (p.actorType === 'SYSTEM' && !paymentSatisfied) {
        throw new DomainError('INVALID_TRANSITION', 'A booking can only be confirmed automatically after verified payment.');
      }
      if (p.actorType === 'STAFF' && !paymentSatisfied && (!reason || reason.length < 3)) {
        throw invalid('Confirming without a verified deposit requires a reason (for example, offline payment received).');
      }
    }
    if (p.actorType === 'STAFF' && (p.to === 'CANCELLED' || p.to === 'REJECTED') && !reason) {
      throw invalid('Please provide a reason.');
    }
    if (p.actorType === 'CUSTOMER' && p.to === 'CANCELLED' && booking.amountPaidMinor > 0) {
      throw new DomainError('INVALID_TRANSITION', 'Paid bookings need a cancellation request so the team can review refunds.');
    }

    const holdUntil =
      p.to === 'AWAITING_PAYMENT'
        ? new Date(now.getTime() + rules.holdMinutes * 60_000)
        : p.to === 'PAYMENT_PENDING'
          ? booking.holdExpiresAt
          : null;

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: p.to,
        holdExpiresAt: holdUntil,
        cancellationReason: p.to === 'CANCELLED' || p.to === 'REJECTED' ? reason : booking.cancellationReason,
        version: { increment: 1 },
      },
    });
    await tx.bookingStatusHistory.create({
      data: { bookingId: booking.id, fromStatus: from, toStatus: p.to, actorType: p.actorType, actorUserId: p.actor?.userId ?? null, reason },
    });
    if (p.actorType !== 'SYSTEM') {
      await recordAudit(p.actor ?? null, {
        action: 'booking.status_changed',
        entityType: 'Booking',
        entityId: booking.id,
        summary: `${booking.reference}: ${from} → ${p.to}`,
        before: { status: from },
        after: { status: p.to, reason },
      }, ctx, tx);
    }
    return updated;
  });
}

/** Customer-initiated cancellation: direct cancel when nothing was paid, otherwise a request. */
export async function customerCancel(reference: string, viewer: Viewer, reason: string | undefined, db: PrismaClient = prisma) {
  const booking = await getBookingForViewer(reference, viewer, db);
  const status = booking.status as BookingStatusValue;
  if (booking.amountPaidMinor === 0 && canTransition(status, 'CANCELLED', 'CUSTOMER')) {
    return transitionBooking({ bookingId: booking.id, to: 'CANCELLED', actorType: 'CUSTOMER', actor: viewer.actor, reason: reason || 'Cancelled by customer' }, db);
  }
  if (canTransition(status, 'CANCELLATION_REQUESTED', 'CUSTOMER')) {
    return transitionBooking({ bookingId: booking.id, to: 'CANCELLATION_REQUESTED', actorType: 'CUSTOMER', actor: viewer.actor, reason: reason || 'Cancellation requested by customer' }, db);
  }
  throw new DomainError('INVALID_TRANSITION', 'This booking cannot be cancelled online. Please contact the team.');
}

export function customerActions(b: Pick<Booking, 'status' | 'amountPaidMinor' | 'depositMinor' | 'totalMinor' | 'holdExpiresAt'>, now = new Date()) {
  const status = b.status as BookingStatusValue;
  const holdValid = !b.holdExpiresAt || b.holdExpiresAt > now;
  return {
    canPayDeposit: (status === 'AWAITING_PAYMENT' || status === 'PAYMENT_PENDING') && holdValid && b.amountPaidMinor < b.depositMinor,
    canPayBalance: (status === 'CONFIRMED' || status === 'AWAITING_PAYMENT') && b.amountPaidMinor < b.totalMinor && holdValid,
    canCancel: b.amountPaidMinor === 0 && canTransition(status, 'CANCELLED', 'CUSTOMER'),
    canRequestCancellation: canTransition(status, 'CANCELLATION_REQUESTED', 'CUSTOMER'),
  };
}

// ---------------------------------------------------------------------------
// Staff operations
// ---------------------------------------------------------------------------

export async function rescheduleBooking(bookingId: string, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma, now = new Date()) {
  const input = rescheduleSchema.parse(raw);
  const date = parseLocalDate(input.date);
  const startMinute = hhmmToMinutes(input.startTime);
  if (!date || startMinute === null) throw invalid('Enter a valid date and time.');

  try {
    return await db.$transaction(async (tx) => {
      await lockBooking(tx, bookingId);
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { service: true } });
      if (!booking) throw notFound('Booking');
      if (!isActiveStatus(booking.status as BookingStatusValue)) {
        throw new DomainError('INVALID_TRANSITION', 'Only active bookings can be rescheduled.');
      }
      const rules = await getSetting('bookingRules', tx);
      validateBookingDate(date, booking.timezone, rules.maxAdvanceDays, now);
      const { resourceId, start } = await reserveSlot(tx, {
        serviceId: booking.serviceId,
        locationId: booking.locationId,
        durationMin: booking.durationMin,
        date,
        startMinute,
        now,
        excludeBookingId: booking.id,
        preferredResourceId: booking.resourceId,
      });
      const end = new Date(start.getTime() + booking.durationMin * 60_000);
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          startsAt: start,
          endsAt: end,
          blockedFrom: start,
          blockedUntil: new Date(end.getTime() + booking.service.bufferMin * 60_000),
          resourceId,
          version: { increment: 1 },
        },
      });
      const fromLocal = formatWhen(booking.startsAt, booking.timezone);
      const toLocal = formatWhen(start, booking.timezone);
      await tx.bookingStatusHistory.create({
        data: { bookingId: booking.id, fromStatus: booking.status, toStatus: booking.status, actorType: 'STAFF', actorUserId: actor.userId, reason: `Rescheduled from ${fromLocal} to ${toLocal}. ${input.reason}` },
      });
      await recordAudit(actor, {
        action: 'booking.rescheduled',
        entityType: 'Booking',
        entityId: booking.id,
        summary: `${booking.reference} rescheduled`,
        before: { startsAt: booking.startsAt, resourceId: booking.resourceId },
        after: { startsAt: start, resourceId, reason: input.reason },
      }, ctx, tx);
      return updated;
    }, TX_OPTIONS);
  } catch (err) {
    if (isOverlapViolation(err)) throw new DomainError('UNAVAILABLE', 'That time conflicts with another booking.');
    throw err;
  }
}

export async function addBookingNote(bookingId: string, body: string, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const text = body.trim();
  if (text.length < 1 || text.length > 4000) throw invalid('Notes must be between 1 and 4000 characters.');
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, reference: true } });
  if (!booking) throw notFound('Booking');
  const note = await db.bookingNote.create({ data: { bookingId, authorId: actor.userId, body: text } });
  await recordAudit(actor, { action: 'booking.note_added', entityType: 'Booking', entityId: bookingId, summary: `Internal note on ${booking.reference}` }, ctx, db);
  return note;
}

/** Local wall-clock date/time of a booking, for forms. */
export function bookingLocalStart(b: Pick<Booking, 'startsAt' | 'timezone'>) {
  const z = utcToZoned(b.startsAt, b.timezone);
  return z;
}
