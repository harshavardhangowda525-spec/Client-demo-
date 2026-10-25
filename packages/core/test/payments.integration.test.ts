import { createHmac } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@studio/db';
import { createBooking } from '../src/booking/service';
import { handleRazorpayWebhook, issueRefund, recordChargeResult, simulateDemoPayment, startPayment, syncRazorpayPayments } from '../src/payments/service';
import { verifyCheckoutSignature, verifyWebhookSignature } from '../src/payments/razorpay';
import { resetEnvCache } from '../src/env';
import { actor, futureWeekday, guest, ids, resetDatabase } from './helpers';

let I: Awaited<ReturnType<typeof ids>>;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Booking", "PaymentOrder", "Transaction", "Refund", "WebhookEvent", "AuditLog" CASCADE');
});

let offset = 30;
async function newBooking() {
  offset += 1;
  return createBooking({ brand: 'PODCAST', serviceId: I.multicam, locationId: I.bom, date: futureWeekday(offset), startTime: '10:00', contact: guest(), acceptTerms: true }, null);
}

describe('demo payments', () => {
  it('a simulated deposit confirms the booking and is flagged as simulated', async () => {
    const { booking, accessToken } = await newBooking();
    const viewer = { actor: null, accessToken };
    const { order, checkout } = await startPayment(booking.reference, viewer, 'DEPOSIT', 'idem-key-0001');
    expect(checkout.provider).toBe('DEMO');
    expect(checkout.isSimulated).toBe(true);
    expect(order.amountMinor).toBe(booking.depositMinor);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('PAYMENT_PENDING');

    await simulateDemoPayment(order.id, 'success', viewer);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe('CONFIRMED');
    expect(after.paymentStatus).toBe('PARTIALLY_PAID');
    expect(after.amountPaidMinor).toBe(booking.depositMinor);
    const txs = await prisma.transaction.findMany({ where: { bookingId: booking.id } });
    expect(txs).toHaveLength(1);
    expect(txs[0]!.isSimulated).toBe(true);
    expect(txs[0]!.provider).toBe('DEMO');
  });

  it('repeating an idempotency key returns the same order', async () => {
    const { booking, accessToken } = await newBooking();
    const a = await startPayment(booking.reference, { actor: null, accessToken }, 'DEPOSIT', 'idem-key-same');
    const b = await startPayment(booking.reference, { actor: null, accessToken }, 'DEPOSIT', 'idem-key-same');
    expect(b.order.id).toBe(a.order.id);
    expect(await prisma.paymentOrder.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('replaying the same provider payment never double-counts money', async () => {
    const { booking, accessToken } = await newBooking();
    const { order } = await startPayment(booking.reference, { actor: null, accessToken }, 'DEPOSIT', undefined);
    const result = { providerPaymentId: 'demo_pay_fixed', status: 'SUCCEEDED' as const, amountMinor: order.amountMinor, currency: 'INR', source: 'test' };
    await recordChargeResult(order.id, result);
    const second = await recordChargeResult(order.id, result);
    expect(second.duplicate).toBe(true);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.amountPaidMinor).toBe(order.amountMinor);
  });

  it('a failed payment returns the booking to awaiting payment', async () => {
    const { booking, accessToken } = await newBooking();
    const { order } = await startPayment(booking.reference, { actor: null, accessToken }, 'DEPOSIT', undefined);
    await simulateDemoPayment(order.id, 'failure', { actor: null, accessToken });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe('AWAITING_PAYMENT');
    expect(after.paymentStatus).toBe('FAILED');
    expect(after.amountPaidMinor).toBe(0);
    expect((await prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('FAILED');
  });

  it('an amount mismatch is treated as a failure, not a payment', async () => {
    const { booking, accessToken } = await newBooking();
    const { order } = await startPayment(booking.reference, { actor: null, accessToken }, 'DEPOSIT', undefined);
    await recordChargeResult(order.id, { providerPaymentId: 'demo_pay_short', status: 'SUCCEEDED', amountMinor: order.amountMinor - 1, currency: 'INR', source: 'test' });
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.amountPaidMinor).toBe(0);
    expect(after.status).not.toBe('CONFIRMED');
  });

  it('other people cannot start or complete payments for a booking', async () => {
    const customer = await actor('customer@demo.example');
    const { booking, accessToken } = await newBooking();
    await expect(startPayment(booking.reference, { actor: customer }, 'DEPOSIT', undefined)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const { order } = await startPayment(booking.reference, { actor: null, accessToken }, 'DEPOSIT', undefined);
    await expect(simulateDemoPayment(order.id, 'success', { actor: customer })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('balance can be paid after confirmation, reaching PAID', async () => {
    const { booking, accessToken } = await newBooking();
    const v = { actor: null, accessToken };
    const dep = await startPayment(booking.reference, v, 'DEPOSIT', undefined);
    await simulateDemoPayment(dep.order.id, 'success', v);
    const bal = await startPayment(booking.reference, v, 'BALANCE', undefined);
    expect(bal.order.amountMinor).toBe(booking.totalMinor - booking.depositMinor);
    await simulateDemoPayment(bal.order.id, 'success', v);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.paymentStatus).toBe('PAID');
    await expect(startPayment(booking.reference, v, 'BALANCE', undefined)).rejects.toThrow(/Nothing is due/);
  });

  it('simulated refunds update balances and stay flagged as simulated', async () => {
    const admin = await actor('admin@demo.example');
    const { booking, accessToken } = await newBooking();
    const v = { actor: null, accessToken };
    const dep = await startPayment(booking.reference, v, 'DEPOSIT', undefined);
    await simulateDemoPayment(dep.order.id, 'success', v);
    const charge = await prisma.transaction.findFirstOrThrow({ where: { bookingId: booking.id, type: 'CHARGE' } });
    await expect(issueRefund(charge.id, charge.amountMinor + 1, 'Too much', admin)).rejects.toThrow(/exceeds/);
    const refund = await issueRefund(charge.id, 10_000, 'Goodwill', admin);
    expect(refund.status).toBe('SUCCEEDED');
    expect(refund.isSimulated).toBe(true);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.amountRefundedMinor).toBe(10_000);
    expect(after.paymentStatus).toBe('PARTIALLY_REFUNDED');
  });
});

describe('Razorpay verification', () => {
  const secret = 'test_webhook_secret';

  it('verifies checkout and webhook signatures', () => {
    const sig = createHmac('sha256', 'k').update('order_1|pay_1').digest('hex');
    expect(verifyCheckoutSignature('order_1', 'pay_1', sig, 'k')).toBe(true);
    expect(verifyCheckoutSignature('order_1', 'pay_2', sig, 'k')).toBe(false);
    const body = '{"a":1}';
    expect(verifyWebhookSignature(body, createHmac('sha256', secret).update(body).digest('hex'), secret)).toBe(true);
    expect(verifyWebhookSignature(body + ' ', createHmac('sha256', secret).update(body).digest('hex'), secret)).toBe(false);
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false);
  });

  async function razorpayOrder() {
    const { booking } = await newBooking();
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'PAYMENT_PENDING' } });
    return prisma.paymentOrder.create({
      data: { bookingId: booking.id, provider: 'RAZORPAY', purpose: 'DEPOSIT', amountMinor: booking.depositMinor, currency: 'INR', providerOrderId: `order_${booking.id}`, idempotencyKey: `k_${booking.id}`, isSimulated: false, status: 'PENDING' },
    });
  }

  const webhook = (order: { providerOrderId: string | null; amountMinor: number }, event = 'payment.captured', status = 'captured') =>
    JSON.stringify({ event, payload: { payment: { entity: { id: 'pay_TEST123', order_id: order.providerOrderId, amount: order.amountMinor, currency: 'INR', status, card: { last4: '1111' } } } } });

  it('rejects webhooks with an invalid signature and changes nothing', async () => {
    const order = await razorpayOrder();
    const body = webhook(order);
    await expect(handleRazorpayWebhook(body, 'bad-signature', 'evt_1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    expect(await prisma.webhookEvent.count({ where: { signatureValid: false } })).toBe(1);
  });

  it('applies a signed payment.captured webhook once, records a real (non-simulated) transaction, and ignores duplicates', async () => {
    const order = await razorpayOrder();
    const body = webhook(order);
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    await handleRazorpayWebhook(body, sig, 'evt_2');
    const dup = await handleRazorpayWebhook(body, sig, 'evt_2');
    expect(dup.duplicate).toBe(true);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: order.bookingId } });
    expect(booking.status).toBe('CONFIRMED');
    expect(booking.amountPaidMinor).toBe(order.amountMinor);
    const tx = await prisma.transaction.findFirstOrThrow({ where: { bookingId: order.bookingId } });
    expect(tx.isSimulated).toBe(false);
    const stored = await prisma.webhookEvent.findFirstOrThrow({ where: { eventId: 'evt_2' } });
    expect(JSON.stringify(stored.payload)).not.toContain('1111');
  });

  it('a payment.failed webhook does not mark anything paid', async () => {
    const order = await razorpayOrder();
    const body = webhook(order, 'payment.failed', 'failed');
    await handleRazorpayWebhook(body, createHmac('sha256', secret).update(body).digest('hex'), 'evt_3');
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: order.bookingId } });
    expect(booking.amountPaidMinor).toBe(0);
    expect(booking.status).toBe('AWAITING_PAYMENT');
  });
});

describe('Razorpay test mode', () => {
  it('payments made with rzp_test_ keys go through Razorpay but are never counted as real money', async () => {
    const saved = { mode: process.env.PAYMENTS_MODE, id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
    Object.assign(process.env, { PAYMENTS_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_test_unit', RAZORPAY_KEY_SECRET: 'unit_secret' });
    resetEnvCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'order_UNIT1', amount: 1, currency: 'INR', status: 'created' }), { status: 200 })));
    try {
      const { booking, accessToken } = await newBooking();
      const { order, checkout } = await startPayment(booking.reference, { actor: null, accessToken }, 'DEPOSIT', 'idem-test-mode-1');
      expect(checkout.provider).toBe('RAZORPAY');
      expect(order.isSimulated).toBe(true);
      await recordChargeResult(order.id, { status: 'SUCCEEDED', amountMinor: order.amountMinor, currency: 'INR', providerPaymentId: 'pay_UNITTEST1', source: 'checkout' });
      const tx = await prisma.transaction.findFirstOrThrow({ where: { bookingId: booking.id } });
      expect(tx.provider).toBe('RAZORPAY');
      expect(tx.isSimulated).toBe(true);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED');
    } finally {
      vi.unstubAllGlobals();
      for (const [k, v] of [['PAYMENTS_MODE', saved.mode], ['RAZORPAY_KEY_ID', saved.id], ['RAZORPAY_KEY_SECRET', saved.secret]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      resetEnvCache();
    }
  });

  it('a checkout whose browser never returned is recorded by asking Razorpay; failed attempts are not', async () => {
    const saved = { mode: process.env.PAYMENTS_MODE, id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
    Object.assign(process.env, { PAYMENTS_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_test_unit', RAZORPAY_KEY_SECRET: 'unit_secret' });
    resetEnvCache();
    let payments: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = String(url).includes('/payments') ? { items: payments } : { id: 'order_SYNC1', amount: 1, currency: 'INR', status: 'created' };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    try {
      const { booking, accessToken } = await newBooking();
      const viewer = { actor: null, accessToken };
      const { order } = await startPayment(booking.reference, viewer, 'DEPOSIT', 'idem-sync-1');
      payments = [{ id: 'pay_FAILED1', order_id: 'order_SYNC1', amount: order.amountMinor, currency: 'INR', status: 'failed' }];
      expect(await syncRazorpayPayments(booking.reference, viewer)).toEqual({ checked: 1, recorded: 0 });
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).amountPaidMinor).toBe(0);
      payments = [...payments, { id: 'pay_OK1', order_id: 'order_SYNC1', amount: order.amountMinor, currency: 'INR', status: 'captured' }];
      expect(await syncRazorpayPayments(booking.reference, viewer)).toEqual({ checked: 1, recorded: 1 });
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.status).toBe('CONFIRMED');
      expect(after.amountPaidMinor).toBe(order.amountMinor);
      // Checking again changes nothing.
      expect(await syncRazorpayPayments(booking.reference, viewer)).toEqual({ checked: 0, recorded: 0 });
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
