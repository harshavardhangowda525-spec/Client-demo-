import { createHmac } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@studio/db';
import { createBooking } from '../src/booking/service';
import { quoteService } from '../src/pricing/service';
import { resetEnvCache } from '../src/env';
import {
  cancelMembership,
  confirmMembershipRazorpay,
  getActiveMembership,
  listPublicPlans,
  membershipSummary,
  simulateMembershipPayment,
  startMembershipCheckout,
  upsertPlan,
} from '../src/membership/service';
import { actor, futureWeekday, ids, resetDatabase } from './helpers';

let I: Awaited<ReturnType<typeof ids>>;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Membership", "Booking", "OfferRedemption", "PaymentOrder", "Transaction", "AuditLog" CASCADE');
  await prisma.offer.updateMany({ data: { usageLimit: null, perCustomerLimit: 1, isActive: true, validFrom: null, validUntil: null } });
});

const customer = () => actor('customer@demo.example');

async function becomeMember(planKey = 'pro') {
  const a = await customer();
  const checkout = await startMembershipCheckout(planKey, a);
  return simulateMembershipPayment(checkout.membershipId, 'success', a);
}

describe('membership plans', () => {
  it('lists the three sample plans in order, priced from the database', async () => {
    const plans = await listPublicPlans();
    expect(plans.map((p) => [p.key, p.priceMinor, p.bookingDiscountBps])).toEqual([['plus', 29_900, 5000], ['pro', 59_900, 5000], ['advanced', 99_900, 5000]]);
    expect(plans.every((p) => p.isSample)).toBe(true);
  });

  it('activates only after payment succeeds; a failed payment gives no membership', async () => {
    const a = await customer();
    const checkout = await startMembershipCheckout('plus', a);
    expect(checkout.amountMinor).toBe(29_900);
    expect(await getActiveMembership(a.userId)).toBeNull();
    await expect(simulateMembershipPayment(checkout.membershipId, 'failure', a)).rejects.toThrow('No membership was activated');
    expect(await getActiveMembership(a.userId)).toBeNull();
    const again = await startMembershipCheckout('plus', a);
    const m = await simulateMembershipPayment(again.membershipId, 'success', a);
    expect(m.status).toBe('ACTIVE');
    expect(m.endsAt!.getTime() - m.startsAt!.getTime()).toBe(30 * 86_400_000);
    // Replaying the same success changes nothing.
    await simulateMembershipPayment(again.membershipId, 'success', a);
    expect(await prisma.membership.count({ where: { userId: a.userId, status: 'ACTIVE' } })).toBe(1);
  });

  it('staff and signed-out visitors cannot buy; another customer cannot complete your purchase', async () => {
    await expect(startMembershipCheckout('pro', null)).rejects.toThrow('sign in');
    await expect(startMembershipCheckout('pro', await actor('staff@demo.example'))).rejects.toThrow('Staff accounts');
    const checkout = await startMembershipCheckout('pro', await customer());
    const other = await prisma.user.create({ data: { id: `u-${Date.now()}`, name: 'Other', email: `other-${Date.now()}@test.example`, role: 'customer' } });
    const { loadActor } = await import('../src/actor');
    await expect(simulateMembershipPayment(checkout.membershipId, 'success', (await loadActor(other.id))!)).rejects.toThrow('not found');
  });

  it('switching plan replaces the current one; renewing the same plan adds a month', async () => {
    const pro = await becomeMember('pro');
    const renewed = await becomeMember('pro');
    expect(renewed.endsAt!.getTime() - pro.endsAt!.getTime()).toBeGreaterThanOrEqual(30 * 86_400_000 - 5_000);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: pro.id } })).status).toBe('CANCELLED');
    const adv = await becomeMember('advanced');
    const summary = await membershipSummary((await customer()).userId);
    expect(summary?.plan.key).toBe('advanced');
    expect(summary?.id).toBe(adv.id);
    expect(await prisma.membership.count({ where: { status: 'ACTIVE' } })).toBe(1);
  });

  it('the database allows only one active membership per user', async () => {
    const m = await becomeMember('plus');
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { key: 'pro' } });
    await expect(prisma.membership.create({ data: { userId: m.userId, planId: plan.id, status: 'ACTIVE', amountMinor: 1, currency: 'INR', provider: 'DEMO', isSimulated: true, startsAt: new Date(), endsAt: new Date(Date.now() + 1000) } })).rejects.toThrow();
  });
});

describe('member prices', () => {
  it('members pay half on the service and add-ons, before fees and tax; others pay full price', async () => {
    const a = await customer();
    const before = await quoteService({ serviceId: I.portrait, userId: a.userId });
    expect(before.membership).toBeNull();
    await becomeMember('pro');
    const q = await quoteService({ serviceId: I.portrait, userId: a.userId });
    expect(q.membership).toMatchObject({ planName: 'Pro', bps: 5000 });
    expect(q.breakdown.discountMinor).toBe(Math.round(before.breakdown.subtotalMinor / 2));
    expect(q.breakdown.lines.find((l) => l.refId === 'MEMBERSHIP')?.description).toBe('Pro member price (50% off)');
    expect(q.breakdown.totalMinor).toBeLessThan(before.breakdown.totalMinor);
    // A guest quote for the same service is unchanged.
    expect((await quoteService({ serviceId: I.portrait })).breakdown.totalMinor).toBe(before.breakdown.totalMinor);
  });

  it('a coupon applies to the member price, and the booking stores both discounts', async () => {
    const a = await customer();
    await becomeMember('plus');
    const { booking } = await createBooking({ brand: 'PHOTO', serviceId: I.portrait, locationId: I.blr, date: futureWeekday(60), startTime: '10:00', contact: { name: 'Demo Customer', email: 'customer@demo.example' }, acceptTerms: true, couponCode: 'DEMO10' }, a);
    const plain = await quoteService({ serviceId: I.portrait });
    const member = Math.round(plain.breakdown.subtotalMinor / 2);
    const coupon = Math.min(Math.round((plain.breakdown.subtotalMinor - member) * 0.1), 100_000);
    expect(booking.discountMinor).toBe(member + coupon);
    expect((await prisma.offerRedemption.findFirstOrThrow({ where: { bookingId: booking.id } })).discountMinor).toBe(coupon);
  });

  it('an expired or cancelled membership stops the discount; admins can change the plan discount', async () => {
    const a = await customer();
    const m = await becomeMember('pro');
    const admin = await actor('admin@demo.example');
    const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { key: 'pro' } });
    await upsertPlan(plan.id, { ...plan, tagline: plan.tagline, bookingDiscountBps: 2500 }, admin);
    expect((await quoteService({ serviceId: I.portrait, userId: a.userId })).membership?.bps).toBe(2500);
    await upsertPlan(plan.id, { ...plan, tagline: plan.tagline, bookingDiscountBps: 5000 }, admin);
    await prisma.membership.update({ where: { id: m.id }, data: { endsAt: new Date(Date.now() - 1000), startsAt: new Date(Date.now() - 2000) } });
    expect((await quoteService({ serviceId: I.portrait, userId: a.userId })).membership).toBeNull();
    const m2 = await becomeMember('pro');
    await cancelMembership(m2.id, admin);
    expect((await quoteService({ serviceId: I.portrait, userId: a.userId })).membership).toBeNull();
  });
});

describe('membership via Razorpay (test mode)', () => {
  it('activates only after the signature is verified and Razorpay reports the payment captured for the right amount', async () => {
    const saved = { mode: process.env.PAYMENTS_MODE, id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
    Object.assign(process.env, { PAYMENTS_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_test_unit', RAZORPAY_KEY_SECRET: 'unit_secret' });
    resetEnvCache();
    let payment: Record<string, unknown> = {};
    let orders = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = String(url).includes('/payments/') ? payment : { id: `order_MEM${++orders}`, amount: 59_900, currency: 'INR', status: 'created' };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    try {
      const a = await customer();
      const sign = (o: string, p: string) => createHmac('sha256', 'unit_secret').update(`${o}|${p}`).digest('hex');
      const checkout = await startMembershipCheckout('pro', a);
      expect(checkout.provider).toBe('RAZORPAY');
      expect(checkout.isSimulated).toBe(true);
      const o1 = checkout.provider === 'RAZORPAY' ? checkout.providerOrderId : '';
      await expect(confirmMembershipRazorpay(checkout.membershipId, { razorpay_order_id: o1, razorpay_payment_id: 'pay_1', razorpay_signature: 'bad' }, a)).rejects.toThrow('signature');
      payment = { id: 'pay_1', order_id: o1, amount: 100, currency: 'INR', status: 'captured' };
      await expect(confirmMembershipRazorpay(checkout.membershipId, { razorpay_order_id: o1, razorpay_payment_id: 'pay_1', razorpay_signature: sign(o1, 'pay_1') }, a)).rejects.toThrow('did not match');
      expect(await getActiveMembership(a.userId)).toBeNull();
      expect((await prisma.membership.findUniqueOrThrow({ where: { id: checkout.membershipId } })).status).toBe('FAILED');

      const second = await startMembershipCheckout('pro', a);
      const o2 = second.provider === 'RAZORPAY' ? second.providerOrderId : '';
      payment = { id: 'pay_2', order_id: o2, amount: 59_900, currency: 'INR', status: 'captured' };
      const m = await confirmMembershipRazorpay(second.membershipId, { razorpay_order_id: o2, razorpay_payment_id: 'pay_2', razorpay_signature: sign(o2, 'pay_2') }, a);
      expect(m.status).toBe('ACTIVE');
      expect(m.isSimulated).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      for (const [k, v] of [['PAYMENTS_MODE', saved.mode], ['RAZORPAY_KEY_ID', saved.id], ['RAZORPAY_KEY_SECRET', saved.secret]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      resetEnvCache();
    }
  });
});
