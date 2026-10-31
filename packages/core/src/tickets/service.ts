import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { getEnv } from '../env';
import { DomainError, notFound } from '../errors';
import { getBookingForViewer, transitionBooking, type Viewer } from '../booking/service';

/** Bookings that have a valid ticket. */
const TICKET_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
/** Check-in opens this long before the session and closes this long after it ends. */
const OPEN_BEFORE_MS = 3 * 60 * 60_000;
const CLOSE_AFTER_MS = 60 * 60_000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function secret(): string {
  const env = getEnv();
  const s = env.TICKET_SIGNING_SECRET ?? env.BETTER_AUTH_SECRET;
  if (!s) throw new DomainError('INTEGRATION_NOT_CONFIGURED', 'E-tickets are not configured on this server.');
  return s;
}

function signature(reference: string): string {
  const mac = createHmac('sha256', secret()).update(`ticket:${reference}`).digest();
  // 10 characters from an unambiguous alphabet (~50 bits): easy to type, infeasible to guess.
  let out = '';
  for (let i = 0; i < 10; i++) out += ALPHABET[mac[i]! % ALPHABET.length];
  return out;
}

/** The value printed under the QR code and encoded in it, e.g. "PH-7K3Q9XMR.H4KZ8MQ2TW". */
export function ticketCode(reference: string): string {
  return `${reference}.${signature(reference)}`;
}

/** Returns the booking reference for a genuine ticket code, or null. */
export function verifyTicketCode(raw: string): string | null {
  const m = raw.trim().toUpperCase().replace(/\s+/g, '').match(/^([A-Z]{2}-[0-9A-Z]{8})\.([A-Z0-9]{10})$/);
  if (!m) return null;
  const expected = Buffer.from(signature(m[1]!));
  const given = Buffer.from(m[2]!);
  return expected.length === given.length && timingSafeEqual(expected, given) ? m[1]! : null;
}

/** E-ticket for the customer: only once the booking is confirmed. */
export async function getTicket(reference: string, viewer: Viewer) {
  const b = await getBookingForViewer(reference, viewer);
  if (!TICKET_STATUSES.includes(b.status)) {
    throw new DomainError('INVALID_TRANSITION', 'Your e-ticket is available once the booking is confirmed.');
  }
  return {
    reference: b.reference,
    code: ticketCode(b.reference),
    status: b.status,
    service: b.service.name,
    package: b.package?.name ?? null,
    location: { name: b.location.name, addressLine1: b.location.addressLine1, city: b.location.city },
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    timezone: b.timezone,
    attendees: b.attendees,
    contactName: b.contactName,
    totalMinor: b.totalMinor,
    amountPaidMinor: b.amountPaidMinor,
    balanceDueMinor: Math.max(0, b.totalMinor - b.amountPaidMinor + b.amountRefundedMinor),
    currency: b.currency,
    checkedInAt: b.checkedInAt?.toISOString() ?? null,
    isDemo: b.isDemo,
  };
}

/** Staff scan or type a ticket code at the studio. Safe to repeat: a second scan reports the first check-in. */
export async function checkIn(rawCode: string, actor: Actor, ctx: RequestContext = {}, db = prisma, now = new Date()) {
  const reference = verifyTicketCode(rawCode);
  if (!reference) throw new DomainError('VALIDATION', 'This is not a valid ticket code.');
  const booking = await db.booking.findUnique({ where: { reference }, include: { service: { select: { name: true } }, location: { select: { name: true } } } });
  if (!booking) throw notFound('Booking');
  const summary = {
    reference,
    contactName: booking.contactName,
    service: booking.service.name,
    location: booking.location.name,
    startsAt: booking.startsAt.toISOString(),
    timezone: booking.timezone,
    attendees: booking.attendees,
    balanceDueMinor: Math.max(0, booking.totalMinor - booking.amountPaidMinor + booking.amountRefundedMinor),
  };
  if (booking.checkedInAt) return { ...summary, alreadyCheckedIn: true, checkedInAt: booking.checkedInAt.toISOString() };
  if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
    throw new DomainError('INVALID_TRANSITION', `This booking is ${booking.status.replace(/_/g, ' ').toLowerCase()} and cannot be checked in.`);
  }
  if (now.getTime() < booking.startsAt.getTime() - OPEN_BEFORE_MS) throw new DomainError('INVALID_TRANSITION', 'Check-in opens 3 hours before the session.');
  if (now.getTime() > booking.endsAt.getTime() + CLOSE_AFTER_MS) throw new DomainError('INVALID_TRANSITION', 'This session has already ended.');

  if (booking.status === 'CONFIRMED') {
    await transitionBooking({ bookingId: booking.id, to: 'IN_PROGRESS', actorType: 'STAFF', actor, reason: 'Checked in with e-ticket', now }, db, ctx);
  }
  const updated = await db.booking.update({ where: { id: booking.id }, data: { checkedInAt: now, checkedInById: actor.userId } });
  await recordAudit(actor, { action: 'booking.checked_in', entityType: 'Booking', entityId: booking.id, summary: `${reference} checked in` }, ctx, db);
  return { ...summary, alreadyCheckedIn: false, checkedInAt: updated.checkedInAt!.toISOString() };
}
