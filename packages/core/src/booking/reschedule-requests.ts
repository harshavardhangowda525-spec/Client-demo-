import { prisma, Prisma, type PrismaClient } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, invalid, notFound } from '../errors';
import { getSetting } from '../settings';
import { formatLocalDate, hhmmToMinutes, minutesToHHMM, parseLocalDate, utcToZoned, zonedToUtc } from '../time';
import { rescheduleRequestSchema } from '../schemas';
import { isSlotBookable } from '../availability/service';
import { getBookingForViewer, rescheduleBooking, type Viewer } from './service';
import { notifyRescheduleDecided, notifyRescheduleRequested } from './notify';

const RESCHEDULABLE = ['ENQUIRY_SUBMITTED', 'AWAITING_REVIEW', 'AWAITING_PAYMENT', 'PAYMENT_PENDING', 'CONFIRMED'];

/**
 * Customer asks to move a booking. The requested time must be free right now,
 * but nothing changes until staff approve: the original slot stays reserved.
 */
export async function requestReschedule(reference: string, viewer: Viewer, raw: unknown, ctx: RequestContext = {}, db: PrismaClient = prisma, now = new Date()) {
  const input = rescheduleRequestSchema.parse(raw);
  const booking = await getBookingForViewer(reference, viewer, db);
  if (!RESCHEDULABLE.includes(booking.status)) throw new DomainError('INVALID_TRANSITION', 'This booking can no longer be rescheduled online. Please contact the team.');
  const rules = await getSetting('bookingRules', db);
  if (booking.startsAt.getTime() - now.getTime() < rules.rescheduleRequestCutoffHours * 3_600_000) {
    throw new DomainError('INVALID_TRANSITION', `Reschedule requests must be made at least ${rules.rescheduleRequestCutoffHours} hours before the session. Please contact the team.`);
  }
  const date = parseLocalDate(input.date);
  const startMinute = hhmmToMinutes(input.startTime);
  if (!date || startMinute === null) throw invalid('Enter a valid date and time.');
  const requestedStart = zonedToUtc(date, startMinute, booking.timezone);
  if (requestedStart.getTime() === booking.startsAt.getTime()) throw invalid('Choose a different time from your current booking.');

  const free = await isSlotBookable({ serviceId: booking.serviceId, locationId: booking.locationId, durationMin: booking.durationMin, date, startMinute, excludeBookingId: booking.id, now }, db);
  if (!free) throw new DomainError('UNAVAILABLE', 'That time is not available. Please choose another slot.');

  try {
    const req = await db.rescheduleRequest.create({ data: { bookingId: booking.id, requestedStart, reason: input.reason || null } });
    await recordAudit(viewer.actor, { action: 'booking.reschedule_requested', entityType: 'Booking', entityId: booking.id, summary: `${booking.reference}: reschedule to ${input.date} ${input.startTime} requested` }, ctx, db);
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    await notifyRescheduleRequested(fresh, requestedStart);
    return req;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new DomainError('CONFLICT', 'A reschedule request is already waiting for the team to review.');
    }
    throw err;
  }
}

/** Staff decision. Approval re-checks availability and moves the booking atomically. */
export async function decideReschedule(requestId: string, approve: boolean, note: string | undefined, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma) {
  const req = await db.rescheduleRequest.findUnique({ where: { id: requestId }, include: { booking: true } });
  if (!req) throw notFound('Reschedule request');
  if (req.status !== 'PENDING') throw new DomainError('INVALID_TRANSITION', 'This request has already been decided.');
  if (approve) {
    const local = utcToZoned(req.requestedStart, req.booking.timezone);
    await rescheduleBooking(req.bookingId, {
      date: formatLocalDate(local.date),
      startTime: minutesToHHMM(local.minuteOfDay),
      reason: `Customer reschedule request approved${note ? `: ${note}` : ''}`,
    }, actor, ctx, db);
  }
  const updated = await db.rescheduleRequest.update({
    where: { id: requestId },
    data: { status: approve ? 'APPROVED' : 'DECLINED', decidedById: actor.userId, decisionNote: note || null, decidedAt: new Date() },
  });
  await recordAudit(actor, { action: approve ? 'booking.reschedule_approved' : 'booking.reschedule_declined', entityType: 'Booking', entityId: req.bookingId, summary: `${req.booking.reference}: reschedule ${approve ? 'approved' : 'declined'}`, after: { note } }, ctx, db);
  const booking = await db.booking.findUniqueOrThrow({ where: { id: req.bookingId } });
  await notifyRescheduleDecided(booking, approve, note);
  return updated;
}

export function listRescheduleRequests(status: 'PENDING' | 'APPROVED' | 'DECLINED' | undefined, db: PrismaClient = prisma) {
  return db.rescheduleRequest.findMany({
    where: status ? { status } : {},
    include: { booking: { select: { id: true, reference: true, startsAt: true, timezone: true, contactName: true, service: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
