import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@studio/db';
import { createBooking, customerCancel, getBookingForViewer, lookupBookingStatus, rescheduleBooking, transitionBooking } from '../src/booking/service';
import { expireStaleHolds, getAvailability } from '../src/availability/service';
import { DomainError } from '../src/errors';
import { actor, futureWeekday, guest, ids, resetDatabase } from './helpers';

let I: Awaited<ReturnType<typeof ids>>;

beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Booking", "PaymentOrder", "Transaction", "Refund", "AuditLog", "Notification" CASCADE');
});

const multicam = (date = futureWeekday(), startTime = '10:00', email = 'a@test.example') => ({
  brand: 'PODCAST', serviceId: I.multicam, locationId: I.bom, date, startTime, contact: guest(email), acceptTerms: true,
});

describe('booking creation', () => {
  it('creates a booking awaiting payment with a server-calculated price and a hold', async () => {
    const { booking, accessToken } = await createBooking({ ...multicam(), totalMinor: 1, price: 1 }, null);
    expect(booking.status).toBe('AWAITING_PAYMENT');
    expect(booking.paymentStatus).toBe('UNPAID');
    // 12,000 INR fixed + 18% sample tax; client-supplied price fields are ignored.
    expect(booking.subtotalMinor).toBe(1_200_000);
    expect(booking.totalMinor).toBe(1_416_000);
    expect(booking.depositMinor).toBe(424_800);
    expect(booking.holdExpiresAt).not.toBeNull();
    expect(booking.reference).toMatch(/^PC-/);
    expect(accessToken.length).toBeGreaterThan(20);
    expect(booking.accessTokenHash).not.toBe(accessToken);
    const history = await prisma.bookingStatusHistory.findMany({ where: { bookingId: booking.id } });
    expect(history).toHaveLength(1);
    const items = await prisma.bookingItem.findMany({ where: { bookingId: booking.id } });
    expect(items.reduce((s, i) => s + i.totalMinor, 0)).toBe(booking.totalMinor);
  });

  it('never confirms a booking just because the form was submitted', async () => {
    const { booking } = await createBooking(multicam(), null);
    expect(booking.status).not.toBe('CONFIRMED');
    const req = await createBooking({ brand: 'PHOTO', serviceId: I.corporateVideo, locationId: I.blr, date: futureWeekday(12), startTime: '09:00', durationMin: 480, contact: guest(), acceptTerms: true }, null);
    expect(req.booking.status).toBe('ENQUIRY_SUBMITTED');
  });

  it('rejects past dates, out-of-hours times and invalid durations', async () => {
    await expect(createBooking(multicam('2020-01-06'), null)).rejects.toThrow(/past/);
    await expect(createBooking(multicam(futureWeekday(), '20:00'), null)).rejects.toThrow(/opening hours/);
    await expect(createBooking({ ...multicam(), durationMin: 45 }, null)).rejects.toThrow(/package|Duration/i);
    await expect(createBooking({ ...multicam(), date: '2026-02-30' }, null)).rejects.toThrow();
    const tooFar = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    await expect(createBooking(multicam(tooFar), null)).rejects.toThrow(/in advance/);
  });

  it('rejects mismatched brand, location and add-ons', async () => {
    await expect(createBooking({ ...multicam(), brand: 'PHOTO' }, null)).rejects.toThrow(/not found/i);
    await expect(createBooking({ ...multicam(), locationId: I.blr }, null)).rejects.toThrow(/not offered/);
    const photoAddOn = await prisma.addOn.findFirstOrThrow({ where: { brand: 'PHOTO' } });
    await expect(createBooking({ ...multicam(), addOnIds: [photoAddOn.id] }, null)).rejects.toThrow(/add-ons/);
  });

  it('refuses enquiry-only services', async () => {
    await expect(
      createBooking({ brand: 'EVENTS', serviceId: I.corporateEvents, locationId: I.garden, date: futureWeekday(), startTime: '10:00', contact: guest(), acceptTerms: true }, null),
    ).rejects.toThrow(/quotation/);
  });
});

describe('conflict prevention', () => {
  it('prevents overlapping bookings of the same exclusive resource', async () => {
    await createBooking(multicam(futureWeekday(), '10:00'), null);
    await expect(createBooking(multicam(futureWeekday(), '11:00'), null)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    // Buffer: 10:00-12:00 + 30 min turnaround, so 12:00 is blocked but 12:30 fits only if within hours.
    await expect(createBooking(multicam(futureWeekday(), '12:00'), null)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('allows exactly one of many simultaneous requests for the same slot', async () => {
    const date = futureWeekday(14);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => createBooking(multicam(date, '14:00', `c${i}@test.example`), null)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(7);
    for (const f of failed) expect((f.reason as DomainError).code).toBe('UNAVAILABLE');
    expect(await prisma.booking.count({ where: { serviceId: I.multicam } })).toBe(1);
  });

  it('assigns another eligible resource when the first is taken, then reports unavailable', async () => {
    const date = futureWeekday(15);
    const mk = (email: string) => ({ brand: 'PHOTO', serviceId: I.product, locationId: I.blr, date, startTime: '10:00', durationMin: 60, contact: guest(email), acceptTerms: true });
    // Product photography can use either of two studios at the Bengaluru location.
    const first = await createBooking(mk('x@test.example'), null);
    const second = await createBooking(mk('y@test.example'), null);
    expect(first.booking.resourceId).not.toBe(second.booking.resourceId);
    await expect(createBooking(mk('z@test.example'), null)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('is backed by the database exclusion constraint', async () => {
    const { booking } = await createBooking(multicam(futureWeekday(16), '10:00'), null);
    const { id: _id, reference: _ref, ...rest } = booking;
    await expect(
      prisma.booking.create({ data: { ...rest, reference: 'PC-DUPLICATE', priceBreakdown: {}, accessTokenHash: null } as never }),
    ).rejects.toThrow(/booking_no_resource_overlap|23P01/);
  });

  it('respects blocked periods', async () => {
    const date = futureWeekday(17);
    const room = await prisma.resource.findFirstOrThrow({ where: { name: 'Multi-camera Set' } });
    await prisma.blockedPeriod.create({ data: { resourceId: room.id, kind: 'MAINTENANCE', startsAt: new Date(`${date}T09:00:00+05:30`), endsAt: new Date(`${date}T13:00:00+05:30`) } });
    await expect(createBooking(multicam(date, '10:00'), null)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    const avail = await getAvailability({ serviceId: I.multicam, locationId: I.bom, date, packageId: undefined });
    expect(avail.days[0]!.slots.map((s) => s.startTime)).not.toContain('10:00');
    await prisma.blockedPeriod.deleteMany({});
  });

  it('releases the slot when the payment hold expires', async () => {
    const date = futureWeekday(18);
    const { booking } = await createBooking(multicam(date, '10:00'), null);
    await prisma.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireStaleHolds()).toBe(1);
    const expired = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(expired.status).toBe('CANCELLED');
    await expect(createBooking(multicam(date, '10:00', 'second@test.example'), null)).resolves.toBeDefined();
  });

  it('availability reflects existing bookings', async () => {
    const date = futureWeekday(19);
    const before = await getAvailability({ serviceId: I.multicam, locationId: I.bom, date });
    expect(before.days[0]!.slots.map((s) => s.startTime)).toContain('10:00');
    expect(before.isDemoAvailability).toBe(true);
    await createBooking(multicam(date, '10:00'), null);
    const after = await getAvailability({ serviceId: I.multicam, locationId: I.bom, date });
    expect(after.days[0]!.slots.map((s) => s.startTime)).not.toContain('10:00');
  });
});

describe('status transitions', () => {
  it('blocks automatic confirmation without verified payment', async () => {
    const { booking } = await createBooking(multicam(futureWeekday(20)), null);
    await expect(transitionBooking({ bookingId: booking.id, to: 'CONFIRMED', actorType: 'SYSTEM' })).rejects.toThrow(/verified payment/);
  });

  it('requires a reason for staff confirmation without payment, and records history and audit', async () => {
    const admin = await actor('admin@demo.example');
    const { booking } = await createBooking(multicam(futureWeekday(21)), null);
    await expect(transitionBooking({ bookingId: booking.id, to: 'CONFIRMED', actorType: 'STAFF', actor: admin })).rejects.toThrow(/reason/);
    const ok = await transitionBooking({ bookingId: booking.id, to: 'CONFIRMED', actorType: 'STAFF', actor: admin, reason: 'Offline bank transfer received' });
    expect(ok.status).toBe('CONFIRMED');
    expect(ok.holdExpiresAt).toBeNull();
    const history = await prisma.bookingStatusHistory.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => h.toStatus)).toEqual(['AWAITING_PAYMENT', 'CONFIRMED']);
    expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: 'booking.status_changed' } })).toBe(1);
  });

  it('rejects invalid transitions', async () => {
    const admin = await actor('admin@demo.example');
    const { booking } = await createBooking(multicam(futureWeekday(22)), null);
    await expect(transitionBooking({ bookingId: booking.id, to: 'COMPLETED', actorType: 'STAFF', actor: admin })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('cancelled bookings free the resource', async () => {
    const admin = await actor('admin@demo.example');
    const date = futureWeekday(23);
    const { booking } = await createBooking(multicam(date), null);
    await transitionBooking({ bookingId: booking.id, to: 'CANCELLED', actorType: 'STAFF', actor: admin, reason: 'Test' });
    await expect(createBooking(multicam(date, '10:00', 'z@test.example'), null)).resolves.toBeDefined();
  });

  it('reschedules with availability re-checked', async () => {
    const admin = await actor('admin@demo.example');
    const date = futureWeekday(24);
    const a = await createBooking(multicam(date, '10:00'), null);
    await createBooking(multicam(date, '14:00', 'b@test.example'), null);
    await expect(rescheduleBooking(a.booking.id, { date, startTime: '13:00', reason: 'Customer asked' }, admin)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    const moved = await rescheduleBooking(a.booking.id, { date, startTime: '17:00', reason: 'Customer asked' }, admin);
    expect(moved.startsAt.toISOString()).toBe(new Date(`${date}T17:00:00+05:30`).toISOString());
  });
});

describe('customer data isolation', () => {
  it('only the owner, a valid token holder or staff can open a booking', async () => {
    const customer = await actor('customer@demo.example');
    const staff = await actor('staff@demo.example');
    const { booking, accessToken } = await createBooking(multicam(futureWeekday(25)), null);
    await expect(getBookingForViewer(booking.reference, { actor: null })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getBookingForViewer(booking.reference, { actor: customer })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getBookingForViewer(booking.reference, { actor: null, accessToken: 'wrong' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(getBookingForViewer(booking.reference, { actor: null, accessToken })).resolves.toBeDefined();
    await expect(getBookingForViewer(booking.reference, { actor: staff })).resolves.toBeDefined();

    const own = await createBooking(multicam(futureWeekday(26)), customer);
    await expect(getBookingForViewer(own.booking.reference, { actor: customer })).resolves.toBeDefined();
  });

  it('a guest using a registered email cannot attach bookings to that account', async () => {
    const customer = await actor('customer@demo.example');
    const { booking } = await createBooking(multicam(futureWeekday(27), '10:00', 'customer@demo.example'), null);
    const profile = await prisma.customerProfile.findUniqueOrThrow({ where: { userId: customer.userId } });
    expect(booking.customerId).not.toBe(profile.id);
    await expect(getBookingForViewer(booking.reference, { actor: customer })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reference lookup needs the matching email and returns a minimal summary', async () => {
    const { booking } = await createBooking(multicam(futureWeekday(28), '10:00', 'match@test.example'), null);
    await expect(lookupBookingStatus(booking.reference, 'other@test.example')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const summary = await lookupBookingStatus(booking.reference.toLowerCase(), 'MATCH@test.example');
    expect(Object.keys(summary).sort()).toEqual(['brand', 'isDemo', 'paymentStatus', 'reference', 'serviceName', 'startsAt', 'status', 'timezone']);
  });

  it('customers cancel unpaid bookings directly', async () => {
    const { booking, accessToken } = await createBooking(multicam(futureWeekday(29)), null);
    const cancelled = await customerCancel(booking.reference, { actor: null, accessToken }, 'Change of plans');
    expect(cancelled.status).toBe('CANCELLED');
  });
});
