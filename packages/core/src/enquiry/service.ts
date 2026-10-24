import { prisma, Prisma, type Db, type EnquiryStatus, type PrismaClient } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { can } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, invalid, notFound } from '../errors';
import { generateAccessToken, generateReference, REFERENCE_PREFIX, verifyToken } from '../ids';
import { createEnquirySchema, quotationDraftSchema, convertQuotationSchema } from '../schemas';
import { getSetting } from '../settings';
import { addDays, compareLocalDates, formatLocalDate, hhmmToMinutes, parseLocalDate, todayIn, zonedToUtc } from '../time';
import { calculatePrice } from '../pricing/engine';
import { resolveCustomer } from '../customers/service';
import { isOverlapViolation, reserveSlot, TX_OPTIONS } from '../booking/service';

/** Hours a converted quotation holds its slot while waiting for the deposit. */
export const QUOTATION_BOOKING_HOLD_HOURS = 72;

const ENQUIRY_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'DECLINED', 'CLOSED'],
  UNDER_REVIEW: ['QUOTED', 'DECLINED', 'CLOSED'],
  QUOTED: ['UNDER_REVIEW', 'ACCEPTED', 'DECLINED', 'CLOSED'],
  ACCEPTED: ['CONVERTED', 'CLOSED'],
  DECLINED: ['UNDER_REVIEW', 'CLOSED'],
  CONVERTED: [],
  CLOSED: [],
};

export type EnquiryBrand = 'PHOTO' | 'PODCAST' | 'EVENTS';

/**
 * Create a project or event enquiry for one website's services. Enquiries are
 * never bookings: they enter the review → quotation → conversion workflow.
 */
export async function createEnquiry(
  raw: unknown,
  actor: Actor | null,
  ctx: RequestContext = {},
  db: PrismaClient = prisma,
  now = new Date(),
  brand: EnquiryBrand = 'EVENTS',
  sourceSite: 'STUDIO' | null = null,
) {
  const input = createEnquirySchema.parse(raw);
  const regional = await getSetting('regional', db);
  const preferred = parseLocalDate(input.preferredDate);
  if (!preferred) throw invalid('Preferred date is not a valid date.');
  const today = todayIn(regional.timezone, now);
  if (compareLocalDates(preferred, addDays(today, 1)) < 0) throw invalid('Preferred date must be in the future.');
  if (input.alternateDate) {
    const alt = parseLocalDate(input.alternateDate);
    if (!alt || compareLocalDates(alt, addDays(today, 1)) < 0) throw invalid('Alternate date must be a valid future date.');
  }

  if (input.categoryId) {
    const cat = await db.category.findUnique({ where: { id: input.categoryId } });
    if (!cat || cat.brand !== brand || !cat.isActive) throw invalid('Unknown category.');
  }
  if (input.locationId) {
    const loc = await db.location.findUnique({ where: { id: input.locationId } });
    if (!loc || !loc.isActive || !loc.brands.includes(brand)) throw invalid('Unknown venue or location.');
  }
  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length) {
    const count = await db.service.count({ where: { id: { in: serviceIds }, brand, isActive: true } });
    if (count !== serviceIds.length) throw invalid('One or more requested services are unavailable.');
  }

  const access = generateAccessToken();
  const enquiry = await db.$transaction(async (tx) => {
    const customer = await resolveCustomer(actor, input.contact, tx);
    return tx.eventEnquiry.create({
      data: {
        reference: generateReference('EQ'),
        accessTokenHash: access.hash,
        brand,
        sourceSite,
        customerId: customer.id,
        categoryId: input.categoryId ?? null,
        eventType: input.eventType,
        preferredDate: new Date(`${input.preferredDate}T00:00:00Z`),
        alternateDate: input.alternateDate ? new Date(`${input.alternateDate}T00:00:00Z`) : null,
        locationId: input.locationId ?? null,
        venueDetails: input.venueDetails || null,
        expectedAttendance: input.expectedAttendance,
        budgetMinMinor: input.budgetMinMinor ?? null,
        budgetMaxMinor: input.budgetMaxMinor ?? null,
        setupRequirements: input.setupRequirements || null,
        notes: input.notes || null,
        companyName: input.companyName || null,
        expectedDuration: input.expectedDuration || null,
        deliverables: input.deliverables ?? null,
        contactName: input.contact.name,
        contactEmail: input.contact.email,
        contactPhone: input.contact.phone ?? null,
        services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
      },
    });
  });
  await recordAudit(actor, { action: 'enquiry.created', entityType: 'EventEnquiry', entityId: enquiry.id, summary: `${enquiry.reference} submitted` }, ctx, db);
  return { enquiry, accessToken: access.token };
}

export async function getEnquiryForViewer(reference: string, viewer: { actor: Actor | null; accessToken?: string | null }, db: Db = prisma) {
  const enquiry = await db.eventEnquiry.findUnique({
    where: { reference: reference.toUpperCase() },
    include: {
      category: true,
      location: true,
      services: { include: { service: { select: { id: true, name: true } } } },
      quotations: { where: { status: { in: ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] } }, include: { lines: { orderBy: { sortOrder: 'asc' } } }, orderBy: { version: 'desc' } },
      booking: { select: { reference: true, status: true } },
    },
  });
  if (!enquiry) throw notFound('Enquiry');
  let allowed = can(viewer.actor, 'enquiries.read') || verifyToken(viewer.accessToken, enquiry.accessTokenHash);
  if (!allowed && viewer.actor) {
    const profile = await db.customerProfile.findUnique({ where: { userId: viewer.actor.userId }, select: { id: true } });
    allowed = profile?.id === enquiry.customerId;
  }
  if (!allowed) throw notFound('Enquiry');
  return enquiry;
}

export async function updateEnquiry(
  enquiryId: string,
  patch: { status?: EnquiryStatus; assignedToId?: string | null; nextFollowUpAt?: string | null },
  actor: Actor,
  ctx: RequestContext = {},
  db: Db = prisma,
) {
  const enquiry = await db.eventEnquiry.findUnique({ where: { id: enquiryId } });
  if (!enquiry) throw notFound('Enquiry');
  if (patch.status && patch.status !== enquiry.status) {
    if (patch.status === 'CONVERTED' || patch.status === 'ACCEPTED' || patch.status === 'QUOTED') {
      throw new DomainError('INVALID_TRANSITION', 'This status is set automatically by the quotation workflow.');
    }
    if (!ENQUIRY_TRANSITIONS[enquiry.status].includes(patch.status)) {
      throw new DomainError('INVALID_TRANSITION', `An enquiry cannot move from ${enquiry.status} to ${patch.status}.`);
    }
  }
  if (patch.assignedToId) {
    const staff = await db.user.findUnique({ where: { id: patch.assignedToId }, include: { roleRef: true } });
    if (!staff || !staff.roleRef.isStaff) throw invalid('Enquiries can only be assigned to staff members.');
  }
  const updated = await db.eventEnquiry.update({
    where: { id: enquiryId },
    data: {
      status: patch.status ?? undefined,
      assignedToId: patch.assignedToId === undefined ? undefined : patch.assignedToId,
      nextFollowUpAt: patch.nextFollowUpAt === undefined ? undefined : patch.nextFollowUpAt ? new Date(patch.nextFollowUpAt) : null,
    },
  });
  await recordAudit(actor, {
    action: 'enquiry.updated',
    entityType: 'EventEnquiry',
    entityId: enquiryId,
    summary: `${enquiry.reference} updated`,
    before: { status: enquiry.status, assignedToId: enquiry.assignedToId },
    after: patch,
  }, ctx, db);
  return updated;
}

export async function addFollowUp(enquiryId: string, note: string, dueAt: string | null | undefined, actor: Actor, db: Db = prisma) {
  const text = note.trim();
  if (!text) throw invalid('Follow-up note is required.');
  const enquiry = await db.eventEnquiry.findUnique({ where: { id: enquiryId } });
  if (!enquiry) throw notFound('Enquiry');
  const due = dueAt ? new Date(dueAt) : null;
  if (due && Number.isNaN(due.getTime())) throw invalid('Invalid follow-up date.');
  const followUp = await db.enquiryFollowUp.create({ data: { enquiryId, authorId: actor.userId, note: text.slice(0, 4000), dueAt: due } });
  if (due) await db.eventEnquiry.update({ where: { id: enquiryId }, data: { nextFollowUpAt: due } });
  return followUp;
}

export async function completeFollowUp(followUpId: string, actor: Actor, db: Db = prisma) {
  const f = await db.enquiryFollowUp.findUnique({ where: { id: followUpId } });
  if (!f) throw notFound('Follow-up');
  await recordAudit(actor, { action: 'enquiry.followup_completed', entityType: 'EventEnquiry', entityId: f.enquiryId }, {}, db);
  return db.enquiryFollowUp.update({ where: { id: followUpId }, data: { completedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

/** Create a new draft, or replace the lines of the current draft. Prices are computed server-side. */
export async function saveQuotationDraft(enquiryId: string, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma, now = new Date()) {
  const input = quotationDraftSchema.parse(raw);
  const [pricing, regional] = await Promise.all([getSetting('pricing', db), getSetting('regional', db)]);
  const breakdown = calculatePrice({
    currency: regional.currency,
    durationMin: 60,
    base: { kind: 'QUOTE', lines: input.lines },
    discountMinor: input.discountMinor,
    taxRateBps: pricing.taxRateBps,
    taxLabel: pricing.taxLabel,
    fees: pricing.fees,
    depositBps: input.depositBps ?? pricing.depositBps,
    minimumDepositMinor: pricing.minimumDepositMinor,
  });
  const validDate = input.validUntil ? parseLocalDate(input.validUntil) : null;
  if (input.validUntil && !validDate) throw invalid('Valid-until must be a valid date.');
  // Valid until the end of that day in the business timezone.
  const validUntil = validDate
    ? zonedToUtc(validDate, 24 * 60 - 1, regional.timezone)
    : new Date(now.getTime() + pricing.quotationValidityDays * 86_400_000);
  if (validUntil <= now) throw invalid('Valid-until date must be in the future.');

  return db.$transaction(async (tx) => {
    const enquiry = await tx.eventEnquiry.findUnique({ where: { id: enquiryId }, include: { quotations: true } });
    if (!enquiry) throw notFound('Enquiry');
    if (enquiry.status === 'CONVERTED' || enquiry.status === 'CLOSED') throw new DomainError('INVALID_TRANSITION', 'This enquiry is closed.');

    const amounts = {
      currency: breakdown.currency,
      subtotalMinor: breakdown.subtotalMinor,
      discountMinor: breakdown.discountMinor,
      feesMinor: breakdown.feesMinor,
      taxMinor: breakdown.taxMinor,
      totalMinor: breakdown.totalMinor,
      depositMinor: breakdown.depositMinor,
      priceBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      validUntil,
      terms: input.terms || null,
      customerMessage: input.customerMessage || null,
    };
    const lines = input.lines.map((l, i) => ({ ...l, totalMinor: breakdown.lines[i]!.totalMinor, sortOrder: i }));

    const draft = enquiry.quotations.find((q) => q.status === 'DRAFT');
    let quotation;
    if (draft) {
      await tx.quotationLine.deleteMany({ where: { quotationId: draft.id } });
      quotation = await tx.quotation.update({ where: { id: draft.id }, data: { ...amounts, lines: { create: lines } }, include: { lines: true } });
    } else {
      // A new version supersedes any proposal that is still open with the customer.
      await tx.quotation.updateMany({ where: { enquiryId, status: 'SENT' }, data: { status: 'SUPERSEDED' } });
      const version = enquiry.quotations.reduce((m, q) => Math.max(m, q.version), 0) + 1;
      quotation = await tx.quotation.create({
        data: { ...amounts, reference: generateReference('QT'), enquiryId, version, createdById: actor.userId, lines: { create: lines } },
        include: { lines: true },
      });
    }
    if (enquiry.status === 'SUBMITTED') await tx.eventEnquiry.update({ where: { id: enquiryId }, data: { status: 'UNDER_REVIEW' } });
    await recordAudit(actor, { action: 'quotation.saved', entityType: 'Quotation', entityId: quotation.id, summary: `${quotation.reference} v${quotation.version} draft saved`, after: { totalMinor: quotation.totalMinor } }, ctx, tx);
    return quotation;
  }, TX_OPTIONS);
}

export async function sendQuotation(quotationId: string, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const q = await tx.quotation.findUnique({ where: { id: quotationId }, include: { enquiry: true } });
    if (!q) throw notFound('Quotation');
    if (q.status !== 'DRAFT') throw new DomainError('INVALID_TRANSITION', 'Only draft quotations can be sent.');
    if (q.validUntil <= new Date()) throw invalid('This quotation has already expired. Update the valid-until date.');
    const sent = await tx.quotation.update({ where: { id: q.id }, data: { status: 'SENT', sentAt: new Date() } });
    await tx.eventEnquiry.update({ where: { id: q.enquiryId }, data: { status: 'QUOTED' } });
    await recordAudit(actor, { action: 'quotation.sent', entityType: 'Quotation', entityId: q.id, summary: `${q.reference} sent to customer` }, ctx, tx);
    return { quotation: sent, enquiry: q.enquiry };
  }, TX_OPTIONS);
}

/** Customer (or staff on the customer's behalf) accepts or declines a sent quotation. */
export async function respondToQuotation(
  quotationId: string,
  decision: 'ACCEPT' | 'DECLINE',
  actor: Actor | null,
  opts: { onBehalf?: boolean; reason?: string } = {},
  ctx: RequestContext = {},
  db: PrismaClient = prisma,
  now = new Date(),
) {
  // Expiry is persisted outside the response transaction so the rejection does not roll it back.
  const current = await db.quotation.findUnique({ where: { id: quotationId } });
  if (!current) throw notFound('Quotation');
  if (current.status === 'SENT' && current.validUntil < now) {
    await db.quotation.updateMany({ where: { id: current.id, status: 'SENT' }, data: { status: 'EXPIRED' } });
    throw new DomainError('INVALID_TRANSITION', 'This proposal has expired. Please ask the team for an updated quotation.');
  }
  return db.$transaction(async (tx) => {
    const q = await tx.quotation.findUnique({ where: { id: quotationId } });
    if (!q) throw notFound('Quotation');
    if (q.status !== 'SENT') throw new DomainError('INVALID_TRANSITION', 'This proposal is no longer open for a response.');
    if (opts.onBehalf && (!opts.reason || opts.reason.trim().length < 3)) {
      throw invalid('Recording a response on behalf of the customer requires a note (for example, "accepted by phone").');
    }
    const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    const updated = await tx.quotation.update({ where: { id: q.id }, data: { status, respondedAt: now } });
    await tx.eventEnquiry.update({ where: { id: q.enquiryId }, data: { status: decision === 'ACCEPT' ? 'ACCEPTED' : 'UNDER_REVIEW' } });
    await recordAudit(actor, {
      action: decision === 'ACCEPT' ? 'quotation.accepted' : 'quotation.declined',
      entityType: 'Quotation',
      entityId: q.id,
      summary: `${q.reference} ${status.toLowerCase()}${opts.onBehalf ? ' (recorded by staff)' : ''}`,
      after: { reason: opts.reason },
    }, ctx, tx);
    return updated;
  }, TX_OPTIONS);
}

/**
 * Convert an accepted quotation into a booking. The slot is verified with the
 * same availability engine and resource locks as direct bookings, and the
 * price comes from the stored quotation (custom pricing).
 */
export async function convertQuotationToBooking(quotationId: string, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma, now = new Date()) {
  const input = convertQuotationSchema.parse(raw);
  const date = parseLocalDate(input.date);
  const startMinute = hhmmToMinutes(input.startTime);
  if (!date || startMinute === null) throw invalid('Enter a valid date and time.');

  try {
    return await db.$transaction(async (tx) => {
      const q = await tx.quotation.findUnique({ where: { id: quotationId }, include: { enquiry: true, lines: { orderBy: { sortOrder: 'asc' } } } });
      if (!q) throw notFound('Quotation');
      if (q.status !== 'ACCEPTED') throw new DomainError('INVALID_TRANSITION', 'Only accepted quotations can be converted into bookings.');
      if (q.enquiry.status === 'CONVERTED') throw new DomainError('CONFLICT', 'This enquiry has already been converted.');

      const service = await tx.service.findUnique({ where: { id: input.serviceId } });
      if (!service || service.brand !== q.enquiry.brand) throw invalid('Choose a service from the same website as the enquiry.');
      const location = await tx.location.findUnique({ where: { id: input.locationId } });
      if (!location || !location.brands.includes(q.enquiry.brand)) throw invalid('Choose a location for this website.');
      const link = await tx.serviceLocation.findUnique({ where: { serviceId_locationId: { serviceId: service.id, locationId: location.id } } });
      if (!link) throw invalid(`${service.name} is not offered at ${location.name}.`);

      const { resourceId, start } = await reserveSlot(tx, {
        serviceId: service.id,
        locationId: location.id,
        durationMin: input.durationMin,
        date,
        startMinute,
        now,
        preferredResourceId: input.resourceId ?? null,
      });
      if (input.resourceId && resourceId !== input.resourceId) {
        throw new DomainError('UNAVAILABLE', 'The selected resource is not available at that time.');
      }
      const end = new Date(start.getTime() + input.durationMin * 60_000);
      const status = q.depositMinor > 0 ? 'AWAITING_PAYMENT' : 'AWAITING_REVIEW';
      const access = generateAccessToken();
      const breakdown = q.priceBreakdown as unknown as { lines: { kind: string; refId: string | null; description: string; quantity: number; unitPriceMinor: number; totalMinor: number }[] };

      const booking = await tx.booking.create({
        data: {
          reference: generateReference(REFERENCE_PREFIX[q.enquiry.brand]),
          accessTokenHash: access.hash,
          brand: q.enquiry.brand,
          customerId: q.enquiry.customerId,
          serviceId: service.id,
          locationId: location.id,
          resourceId,
          enquiryId: q.enquiryId,
          quotationId: q.id,
          sourceSite: q.enquiry.sourceSite,
          startsAt: start,
          endsAt: end,
          blockedFrom: start,
          blockedUntil: new Date(end.getTime() + service.bufferMin * 60_000),
          timezone: location.timezone,
          durationMin: input.durationMin,
          attendees: q.enquiry.expectedAttendance,
          status,
          paymentStatus: q.totalMinor === 0 ? 'NOT_REQUIRED' : 'UNPAID',
          currency: q.currency,
          subtotalMinor: q.subtotalMinor,
          discountMinor: q.discountMinor,
          feesMinor: q.feesMinor,
          taxMinor: q.taxMinor,
          totalMinor: q.totalMinor,
          depositMinor: q.depositMinor,
          priceBreakdown: q.priceBreakdown as Prisma.InputJsonValue,
          pricingVersion: `quotation:${q.reference}:v${q.version}`,
          holdExpiresAt: status === 'AWAITING_PAYMENT' ? new Date(now.getTime() + QUOTATION_BOOKING_HOLD_HOURS * 3_600_000) : null,
          contactName: q.enquiry.contactName,
          contactEmail: q.enquiry.contactEmail,
          contactPhone: q.enquiry.contactPhone,
          customerNotes: q.enquiry.notes,
          isDemo: q.enquiry.isDemo,
          items: {
            create: breakdown.lines.map((l, i) => ({
              kind: l.kind as 'QUOTE_LINE',
              refId: l.refId,
              description: l.description,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
              totalMinor: l.totalMinor,
              sortOrder: i,
            })),
          },
          history: {
            create: { fromStatus: null, toStatus: status, actorType: 'STAFF', actorUserId: actor.userId, reason: `Converted from accepted quotation ${q.reference} (v${q.version})` },
          },
        },
      });
      await tx.eventEnquiry.update({ where: { id: q.enquiryId }, data: { status: 'CONVERTED' } });
      await recordAudit(actor, { action: 'quotation.converted', entityType: 'Booking', entityId: booking.id, summary: `${q.reference} converted to ${booking.reference}` }, ctx, tx);
      return { booking, accessToken: access.token };
    }, TX_OPTIONS);
  } catch (err) {
    if (isOverlapViolation(err)) throw new DomainError('UNAVAILABLE', 'That time conflicts with another booking.');
    throw err;
  }
}

export function enquiryDateString(d: Date) {
  return formatLocalDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}
