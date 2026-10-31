import { canReview, customerActions, PAYMENT_STATUS_LABELS, STATUS_DESCRIPTIONS, STATUS_LABELS, type BookingStatusValue } from '@studio/core';
import type { getBookingForViewer } from '@studio/core';

type BookingWithRelations = Awaited<ReturnType<typeof getBookingForViewer>>;

/**
 * What a customer (or guest with a valid access token) may see about their own
 * booking. Internal notes, resource assignment, actor identities and provider
 * secrets are deliberately excluded.
 */
export function customerBookingDto(b: BookingWithRelations) {
  const status = b.status as BookingStatusValue;
  return {
    reference: b.reference,
    brand: b.brand,
    status,
    statusLabel: STATUS_LABELS[status],
    statusDescription: STATUS_DESCRIPTIONS[status],
    paymentStatus: b.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[b.paymentStatus],
    service: { id: b.service.id, name: b.service.name, slug: b.service.slug },
    package: b.package ? { id: b.package.id, name: b.package.name } : null,
    location: {
      name: b.location.name,
      addressLine1: b.location.addressLine1,
      addressLine2: b.location.addressLine2,
      city: b.location.city,
      isDemo: b.location.isDemo,
    },
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    timezone: b.timezone,
    durationMin: b.durationMin,
    attendees: b.attendees,
    currency: b.currency,
    items: b.items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity, unitPriceMinor: i.unitPriceMinor, totalMinor: i.totalMinor })),
    subtotalMinor: b.subtotalMinor,
    discountMinor: b.discountMinor,
    feesMinor: b.feesMinor,
    taxMinor: b.taxMinor,
    totalMinor: b.totalMinor,
    depositMinor: b.depositMinor,
    amountPaidMinor: b.amountPaidMinor,
    amountRefundedMinor: b.amountRefundedMinor,
    balanceDueMinor: Math.max(b.totalMinor - b.amountPaidMinor, 0),
    holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
    contact: { name: b.contactName, email: b.contactEmail, phone: b.contactPhone },
    customerNotes: b.customerNotes,
    cancellationReason: b.cancellationReason,
    isDemo: b.isDemo,
    history: b.history.map((h) => ({ status: h.toStatus, label: STATUS_LABELS[h.toStatus as BookingStatusValue], at: h.createdAt.toISOString(), reason: h.actorType === 'STAFF' && h.fromStatus === h.toStatus ? 'Updated by the team' : h.reason })),
    payments: b.transactions.map((t) => ({ type: t.type, status: t.status, amountMinor: t.amountMinor, isSimulated: t.isSimulated, at: t.createdAt.toISOString() })),
    actions: {
      ...customerActions(b),
      canRequestReschedule:
        ['ENQUIRY_SUBMITTED', 'AWAITING_REVIEW', 'AWAITING_PAYMENT', 'PAYMENT_PENDING', 'CONFIRMED'].includes(status) && !b.rescheduleRequests.some((r) => r.status === 'PENDING'),
      canReview: canReview(b) && b.review?.status !== 'HIDDEN',
      hasTicket: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(status),
    },
    review: b.review ? { rating: b.review.rating, comment: b.review.comment, status: b.review.status, createdAt: b.review.createdAt.toISOString() } : null,
    offer: b.offer ? { code: b.offer.code, title: b.offer.title } : null,
    checkedInAt: b.checkedInAt?.toISOString() ?? null,
    sourceSite: b.sourceSite,
    rescheduleRequests: b.rescheduleRequests.map((r) => ({ id: r.id, status: r.status, requestedStart: r.requestedStart.toISOString(), reason: r.reason, decisionNote: r.decisionNote, createdAt: r.createdAt.toISOString() })),
    createdAt: b.createdAt.toISOString(),
  };
}
