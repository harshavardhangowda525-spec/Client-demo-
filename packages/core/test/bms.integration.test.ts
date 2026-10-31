import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@studio/db';
import { createBooking, transitionBooking } from '../src/booking/service';
import { quoteService } from '../src/pricing/service';
import { evaluateCoupon, upsertOffer } from '../src/offers/service';
import { listServiceReviews, moderateReview, publicReviewerName, ratingSummaries, submitReview } from '../src/reviews/service';
import { checkIn, getTicket, ticketCode, verifyTicketCode } from '../src/tickets/service';
import { getShowtimes } from '../src/studio/catalog';
import { actor, futureWeekday, guest, ids, resetDatabase } from './helpers';

let I: Awaited<ReturnType<typeof ids>>;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Booking", "OfferRedemption", "Review", "Notification", "PaymentOrder", "Transaction", "AuditLog" CASCADE');
  await prisma.offer.updateMany({ data: { usageLimit: null, perCustomerLimit: 1, isActive: true, validFrom: null, validUntil: null } });
});

let offset = 40;
const book = (over: Record<string, unknown> = {}, email = `g${offset}@test.example`) => {
  offset += 1;
  return createBooking({ brand: 'PHOTO', serviceId: I.portrait, locationId: I.blr, date: futureWeekday(offset), startTime: '10:00', contact: guest(email), acceptTerms: true, ...over }, null);
};

describe('offers and coupon codes', () => {
  it('applies a valid coupon before fees and tax, capped by the offer maximum', async () => {
    const plain = await quoteService({ serviceId: I.portrait });
    const q = await quoteService({ serviceId: I.portrait, couponCode: ' demo10 ' });
    const line = q.breakdown.lines.find((l) => l.kind === 'DISCOUNT')!;
    expect(line.description).toBe('Offer DEMO10');
    expect(q.breakdown.discountMinor).toBe(Math.min(Math.round(plain.breakdown.subtotalMinor * 0.1), 100_000));
    expect(q.breakdown.totalMinor).toBeLessThan(plain.breakdown.totalMinor);
    expect(q.breakdown.taxMinor).toBeLessThan(plain.breakdown.taxMinor);
    expect(q.offer?.code).toBe('DEMO10');
  });

  it('rejects unknown, inactive, expired, wrong-service and below-minimum coupons with clear messages', async () => {
    await expect(quoteService({ serviceId: I.portrait, couponCode: 'NOPE' })).rejects.toThrow('not valid');
    await expect(quoteService({ serviceId: I.portrait, couponCode: 'PODCAST500' })).rejects.toThrow('cannot be used for this service');
    await prisma.offer.update({ where: { code: 'DEMO10' }, data: { validUntil: new Date(Date.now() - 1000) } });
    await expect(quoteService({ serviceId: I.portrait, couponCode: 'DEMO10' })).rejects.toThrow('expired');
    await prisma.offer.update({ where: { code: 'DEMO10' }, data: { validUntil: null, isActive: false } });
    await expect(quoteService({ serviceId: I.portrait, couponCode: 'DEMO10' })).rejects.toThrow('not valid');
    await prisma.offer.update({ where: { code: 'DEMO10' }, data: { isActive: true } });
    await expect(evaluateCoupon('DEMO10', { serviceId: I.portrait, subtotalMinor: 100 })).rejects.toThrow('minimum order');
  });

  it('records the redemption with the booking and enforces the per-customer limit', async () => {
    const { booking } = await book({ couponCode: 'DEMO10' }, 'once@test.example');
    expect(booking.offerId).not.toBeNull();
    expect(booking.discountMinor).toBeGreaterThan(0);
    expect(await prisma.offerRedemption.count({ where: { bookingId: booking.id } })).toBe(1);
    await expect(book({ couponCode: 'DEMO10' }, 'once@test.example')).rejects.toThrow('already used');
    // A cancelled booking gives the use back.
    await transitionBooking({ bookingId: booking.id, to: 'CANCELLED', actorType: 'STAFF', reason: 'test' });
    await expect(book({ couponCode: 'DEMO10' }, 'once@test.example')).resolves.toBeTruthy();
  });

  it('never exceeds the total usage limit, even with simultaneous bookings', async () => {
    await prisma.offer.update({ where: { code: 'DEMO10' }, data: { usageLimit: 1 } });
    const results = await Promise.allSettled([1, 2, 3].map((n) => book({ couponCode: 'DEMO10' }, `race${n}@test.example`)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.offerRedemption.count()).toBe(1);
  });

  it('validates admin offer input', async () => {
    const admin = await actor('admin@demo.example');
    await expect(upsertOffer(null, { code: 'X', title: 'Bad', discountType: 'PERCENT', value: 500 }, admin)).rejects.toThrow();
    await expect(upsertOffer(null, { code: 'TOOMUCH', title: 'Too much', discountType: 'PERCENT', value: 20_000 }, admin)).rejects.toThrow('100%');
    await expect(upsertOffer(null, { code: 'DEMO10', title: 'Clash', discountType: 'FLAT', value: 100 }, admin)).rejects.toThrow('already used');
    const ok = await upsertOffer(null, { code: 'flat200', title: 'Flat ₹200', discountType: 'FLAT', value: 20_000 }, admin);
    expect(ok.code).toBe('FLAT200');
    await prisma.offer.delete({ where: { id: ok.id } });
  });
});

describe('ratings and reviews', () => {
  it('only allows a review after the session, by the customer, and keeps names private', async () => {
    const { booking, accessToken } = await book();
    const viewer = { actor: null, accessToken };
    await expect(submitReview(booking.reference, viewer, { rating: 5 })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } });
    await expect(submitReview(booking.reference, viewer, { rating: 9 })).rejects.toThrow();
    await submitReview(booking.reference, viewer, { rating: 4, comment: 'Lovely light and a helpful team.' });
    await submitReview(booking.reference, viewer, { rating: 5, comment: 'Edited: even better on reflection.' });
    expect(await prisma.review.count({ where: { bookingId: booking.id } })).toBe(1);
    const list = await listServiceReviews(I.portrait);
    expect(list.count).toBe(1);
    expect(list.average).toBe(5);
    expect(list.items[0]!.author).toBe('Test G.');
    expect(publicReviewerName('Asha')).toBe('Asha');

    // Staff cannot write a review for the customer.
    const admin = await actor('admin@demo.example');
    await expect(submitReview(booking.reference, { actor: admin }, { rating: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('hidden reviews drop out of ratings and need a reason', async () => {
    const { booking, accessToken } = await book();
    // Move the whole session into the past (start, end and blocked window together).
    const start = new Date(Date.now() - 3 * 3_600_000), end = new Date(Date.now() - 60_000);
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED', startsAt: start, endsAt: end, blockedFrom: start, blockedUntil: end } });
    const review = await submitReview(booking.reference, { actor: null, accessToken }, { rating: 2 });
    expect((await ratingSummaries([I.portrait])).get(I.portrait)?.count).toBe(1);
    const admin = await actor('admin@demo.example');
    await expect(moderateReview(review.id, false, '', admin)).rejects.toThrow('reason');
    await moderateReview(review.id, false, 'Contains personal details', admin);
    expect((await ratingSummaries([I.portrait])).get(I.portrait)).toBeUndefined();
    await expect(submitReview(booking.reference, { actor: null, accessToken }, { rating: 5 })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('e-tickets and check-in', () => {
  it('signs ticket codes so they cannot be forged from a reference', () => {
    const code = ticketCode('PH-ABCDEFGH');
    expect(verifyTicketCode(code)).toBe('PH-ABCDEFGH');
    expect(verifyTicketCode(code.toLowerCase())).toBe('PH-ABCDEFGH');
    expect(verifyTicketCode('PH-ABCDEFGH.AAAAAAAAAA')).toBeNull();
    expect(verifyTicketCode(code.replace('PH-ABCDEFGH', 'PH-ABCDEFGJ'))).toBeNull();
  });

  it('issues a ticket only once confirmed, and checks in once within the window', async () => {
    const { booking, accessToken } = await book();
    await expect(getTicket(booking.reference, { actor: null, accessToken })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    const staff = await actor('admin@demo.example');
    await transitionBooking({ bookingId: booking.id, to: 'CONFIRMED', actorType: 'STAFF', actor: staff, reason: 'Paid at the studio' });
    const ticket = await getTicket(booking.reference, { actor: null, accessToken });
    expect(ticket.code).toBe(ticketCode(booking.reference));

    await expect(checkIn(ticket.code, staff, {}, prisma, new Date(booking.startsAt.getTime() - 5 * 3_600_000))).rejects.toThrow('opens 3 hours');
    const first = await checkIn(ticket.code, staff, {}, prisma, new Date(booking.startsAt.getTime() - 30 * 60_000));
    expect(first.alreadyCheckedIn).toBe(false);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('IN_PROGRESS');
    const second = await checkIn(ticket.code, staff, {}, prisma, new Date(booking.startsAt.getTime()));
    expect(second.alreadyCheckedIn).toBe(true);
    await expect(checkIn('PH-ABCDEFGH.AAAAAAAAAA', staff)).rejects.toThrow('not a valid ticket');
  });
});

describe('showtimes-style slot picker', () => {
  it('lists every studio with free times for a date, using the booking engine', async () => {
    const st = await getShowtimes('audio-recording', { date: futureWeekday(12) });
    expect(st.locations.length).toBeGreaterThan(1);
    expect(st.days.length).toBeGreaterThan(10);
    expect(st.locations.some((l) => l.slots.length > 0)).toBe(true);
    const enquiry = await getShowtimes('brand-and-advertising-shoots', {});
    expect(enquiry.locations).toEqual([]);
  });
});
