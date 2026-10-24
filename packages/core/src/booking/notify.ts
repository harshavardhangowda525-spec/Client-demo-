import { prisma, type Booking, type EventEnquiry, type Quotation } from '@studio/db';
import { getEnv, siteUrl } from '../env';
import { formatMoney } from '../money';
import { getSetting } from '../settings';
import { notify, notifySafely } from '../notifications/service';
import { formatWhen } from './service';
import { STATUS_DESCRIPTIONS, STATUS_LABELS, type BookingStatusValue } from './status';

type SiteKey = 'PHOTO' | 'PODCAST' | 'EVENTS' | 'STUDIO';

/** The website a customer used; links and brand names in messages point there. */
function siteOf(b: { sourceSite: string | null; brand: string }): SiteKey {
  return (b.sourceSite ?? b.brand) as SiteKey;
}

function statusLink(b: Pick<Booking, 'sourceSite' | 'brand' | 'reference'>, token?: string) {
  const base = `${siteUrl(siteOf(b))}/booking-status?ref=${encodeURIComponent(b.reference)}`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
}

async function bookingContext(booking: Booking) {
  const [site, service, location] = await Promise.all([
    getSetting('siteContent'),
    prisma.service.findUnique({ where: { id: booking.serviceId }, select: { name: true } }),
    prisma.location.findUnique({ where: { id: booking.locationId }, select: { name: true } }),
  ]);
  return { brandName: site[siteOf(booking)].name, service: service?.name ?? '', location: location?.name ?? '', when: formatWhen(booking.startsAt, booking.timezone) };
}

async function notifyStaff(template: 'staff.new_booking' | 'staff.new_enquiry', data: Record<string, string | number | null | undefined>, ids: { bookingId?: string; enquiryId?: string }) {
  const business = await getSetting('business');
  notifySafely({ template, recipient: business.email, data: { ...data, adminLink: getEnv().SITE_URL_ADMIN }, ...ids });
}

export async function notifyBookingCreated(booking: Booking, accessToken: string) {
  const ctx = await bookingContext(booking);
  const status = booking.status as BookingStatusValue;
  notifySafely({
    template: 'booking.received',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: { name: booking.contactName, reference: booking.reference, service: ctx.service, when: ctx.when, status: STATUS_LABELS[status], nextStep: STATUS_DESCRIPTIONS[status], link: statusLink(booking, accessToken), brandName: ctx.brandName },
  });
  await notifyStaff('staff.new_booking', { reference: booking.reference, service: ctx.service, when: ctx.when, customer: `${booking.contactName} <${booking.contactEmail}>`, status: STATUS_LABELS[status] }, { bookingId: booking.id });
}

export async function notifyBookingStatus(booking: Booking, reason?: string | null) {
  const ctx = await bookingContext(booking);
  const status = booking.status as BookingStatusValue;
  notifySafely({
    template: status === 'CONFIRMED' ? 'booking.confirmed' : 'booking.status_changed',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: { name: booking.contactName, reference: booking.reference, service: ctx.service, when: ctx.when, status: STATUS_LABELS[status], reason: reason ?? '', link: statusLink(booking), brandName: ctx.brandName },
  });
}

export async function notifyPayment(booking: Booking, ok: boolean, amountMinor: number, simulated: boolean) {
  const ctx = await bookingContext(booking);
  notifySafely({
    template: ok ? 'payment.received' : 'payment.failed',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: {
      name: booking.contactName,
      reference: booking.reference,
      amount: formatMoney(amountMinor, booking.currency),
      simulatedNote: simulated ? '\n\nTHIS WAS A SIMULATED DEMO PAYMENT. NO MONEY WAS TAKEN.' : '',
      brandName: ctx.brandName,
    },
  });
}

export async function notifyRescheduleRequested(booking: Booking, requested: Date) {
  const ctx = await bookingContext(booking);
  notifySafely({
    template: 'reschedule.requested',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: { name: booking.contactName, reference: booking.reference, requested: formatWhen(requested, booking.timezone), link: statusLink(booking), brandName: ctx.brandName },
  });
}

export async function notifyRescheduleDecided(booking: Booking, approved: boolean, note?: string | null) {
  const ctx = await bookingContext(booking);
  notifySafely({
    template: 'reschedule.decided',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: { name: booking.contactName, reference: booking.reference, decision: approved ? 'approved' : 'declined', when: ctx.when, note: note ?? '', link: statusLink(booking), brandName: ctx.brandName },
  });
}

function enquiryLink(enquiry: Pick<EventEnquiry, 'sourceSite' | 'brand' | 'reference'>, token?: string) {
  const base = `${siteUrl(siteOf(enquiry))}/enquiry-status?ref=${enquiry.reference}`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
}

export async function notifyEnquiryReceived(enquiry: EventEnquiry, accessToken: string) {
  const site = await getSetting('siteContent');
  const date = enquiry.preferredDate.toISOString().slice(0, 10);
  notifySafely({
    template: 'enquiry.received',
    recipient: enquiry.contactEmail,
    enquiryId: enquiry.id,
    data: { name: enquiry.contactName, reference: enquiry.reference, eventType: enquiry.eventType, date, link: enquiryLink(enquiry, accessToken), brandName: site[siteOf(enquiry)].name },
  });
  await notifyStaff('staff.new_enquiry', { reference: enquiry.reference, eventType: enquiry.eventType, date, customer: `${enquiry.contactName} <${enquiry.contactEmail}>` }, { enquiryId: enquiry.id });
}

export async function notifyQuotationSent(quotation: Quotation, enquiry: EventEnquiry) {
  const site = await getSetting('siteContent');
  notifySafely({
    template: 'quotation.sent',
    recipient: enquiry.contactEmail,
    enquiryId: enquiry.id,
    data: {
      name: enquiry.contactName,
      reference: quotation.reference,
      total: formatMoney(quotation.totalMinor, quotation.currency),
      validUntil: quotation.validUntil.toISOString().slice(0, 10),
      link: enquiryLink(enquiry),
      brandName: site[siteOf(enquiry)].name,
    },
  });
}

/**
 * Send reminders for confirmed sessions starting within `windowHours`.
 * Idempotent (one reminder per booking) and respects customer preferences.
 * Run from a scheduler (e.g. hourly) or the admin "Send reminders" action.
 */
export async function sendUpcomingReminders(windowHours = 24, now = new Date()) {
  const until = new Date(now.getTime() + windowHours * 3_600_000);
  const due = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      startsAt: { gt: now, lte: until },
      notifications: { none: { template: 'booking.reminder' } },
    },
    include: { customer: true },
  });
  let sent = 0;
  for (const b of due) {
    const ctx = await bookingContext(b);
    const data = { name: b.contactName, reference: b.reference, service: ctx.service, when: ctx.when, location: ctx.location, link: statusLink(b), brandName: ctx.brandName };
    // Awaited (not fire-and-forget) so a second run sees the record and never double-sends.
    if (b.customer.notifyEmail) {
      await notify({ template: 'booking.reminder', recipient: b.contactEmail, bookingId: b.id, data }).catch((e) => console.error('[reminders]', e));
      sent++;
    }
    if (b.customer.notifyWhatsapp && b.customer.whatsappConsentAt && b.contactPhone) {
      await notify({ channel: 'WHATSAPP', template: 'booking.reminder', recipient: b.contactPhone, bookingId: b.id, data }).catch((e) => console.error('[reminders]', e));
    }
    if (!b.customer.notifyEmail && !(b.customer.notifyWhatsapp && b.customer.whatsappConsentAt)) {
      // Record the decision so the reminder job does not re-evaluate this booking.
      await prisma.notification.create({ data: { channel: 'EMAIL', template: 'booking.reminder', recipient: b.contactEmail, body: 'Not sent: customer opted out of reminders.', status: 'PREVIEW_ONLY', bookingId: b.id } });
    }
  }
  return { considered: due.length, sent };
}
