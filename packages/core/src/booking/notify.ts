import { prisma, type Booking, type EventEnquiry, type Quotation } from '@studio/db';
import { siteUrl } from '../env';
import { formatMoney } from '../money';
import { getSetting } from '../settings';
import { notifySafely } from '../notifications/service';
import { formatWhen } from './service';
import { STATUS_DESCRIPTIONS, STATUS_LABELS, type BookingStatusValue } from './status';

function statusLink(brand: Booking['brand'], reference: string, token?: string) {
  const base = `${siteUrl(brand)}/booking-status?ref=${encodeURIComponent(reference)}`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
}

export async function notifyBookingCreated(booking: Booking, accessToken: string) {
  const [site, service] = await Promise.all([
    getSetting('siteContent'),
    prisma.service.findUnique({ where: { id: booking.serviceId }, select: { name: true } }),
  ]);
  const status = booking.status as BookingStatusValue;
  notifySafely({
    template: 'booking.received',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: {
      name: booking.contactName,
      reference: booking.reference,
      service: service?.name,
      when: formatWhen(booking.startsAt, booking.timezone),
      status: STATUS_LABELS[status],
      nextStep: STATUS_DESCRIPTIONS[status],
      link: statusLink(booking.brand, booking.reference, accessToken),
      brandName: site[booking.brand].name,
    },
  });
}

export async function notifyBookingStatus(booking: Booking, reason?: string | null) {
  const site = await getSetting('siteContent');
  const status = booking.status as BookingStatusValue;
  const service = await prisma.service.findUnique({ where: { id: booking.serviceId }, select: { name: true } });
  notifySafely({
    template: status === 'CONFIRMED' ? 'booking.confirmed' : 'booking.status_changed',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: {
      name: booking.contactName,
      reference: booking.reference,
      service: service?.name,
      when: formatWhen(booking.startsAt, booking.timezone),
      status: STATUS_LABELS[status],
      reason: reason ?? '',
      brandName: site[booking.brand].name,
    },
  });
}

export async function notifyPayment(booking: Booking, ok: boolean, amountMinor: number, simulated: boolean) {
  const site = await getSetting('siteContent');
  notifySafely({
    template: ok ? 'payment.received' : 'payment.failed',
    recipient: booking.contactEmail,
    bookingId: booking.id,
    data: { name: booking.contactName, reference: booking.reference, amount: formatMoney(amountMinor, booking.currency), simulated: simulated ? 1 : 0, brandName: site[booking.brand].name },
  });
}

export async function notifyEnquiryReceived(enquiry: EventEnquiry, accessToken: string) {
  const site = await getSetting('siteContent');
  notifySafely({
    template: 'enquiry.received',
    recipient: enquiry.contactEmail,
    enquiryId: enquiry.id,
    data: {
      name: enquiry.contactName,
      reference: enquiry.reference,
      eventType: enquiry.eventType,
      date: enquiry.preferredDate.toISOString().slice(0, 10),
      link: `${siteUrl('EVENTS')}/enquiry-status?ref=${enquiry.reference}&token=${encodeURIComponent(accessToken)}`,
      brandName: site.EVENTS.name,
    },
  });
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
      link: `${siteUrl('EVENTS')}/enquiry-status?ref=${enquiry.reference}`,
      brandName: site.EVENTS.name,
    },
  });
}
