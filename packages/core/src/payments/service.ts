import { randomBytes } from 'node:crypto';
import { prisma, Prisma, type Booking, type PaymentOrder, type PaymentPurpose, type PaymentStatus, type PrismaClient } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit, redact } from '../audit';
import { DomainError, invalid, notFound } from '../errors';
import { getEnv } from '../env';
import { expireStaleHolds } from '../availability/service';
import { getBookingForViewer, transitionBooking, TX_OPTIONS, type Tx, type Viewer } from '../booking/service';
import { siteContentFor, getAllSettings } from '../settings';
import {
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  fetchRazorpayRefund,
  razorpayConfigured,
  razorpayTestMode,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from './razorpay';

export type CheckoutDescriptor =
  | { provider: 'DEMO'; isSimulated: true; orderId: string; amountMinor: number; currency: string }
  | {
      provider: 'RAZORPAY';
      isSimulated: false;
      orderId: string;
      providerOrderId: string;
      keyId: string;
      amountMinor: number;
      currency: string;
      merchantName: string;
      prefill: { name: string; email: string; contact?: string };
    };

export function activePaymentProvider(): 'DEMO' | 'RAZORPAY' | null {
  const mode = getEnv().PAYMENTS_MODE;
  if (mode === 'demo') return 'DEMO';
  if (mode === 'live') return razorpayConfigured() ? 'RAZORPAY' : null;
  return null;
}

export function computePaymentStatus(b: Pick<Booking, 'totalMinor' | 'amountPaidMinor' | 'amountRefundedMinor'>, hasPending = false): PaymentStatus {
  if (b.totalMinor === 0) return 'NOT_REQUIRED';
  if (b.amountRefundedMinor > 0) return b.amountRefundedMinor >= b.amountPaidMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  if (b.amountPaidMinor >= b.totalMinor) return 'PAID';
  if (b.amountPaidMinor > 0) return 'PARTIALLY_PAID';
  return hasPending ? 'PENDING' : 'UNPAID';
}

function amountFor(booking: Booking, purpose: PaymentPurpose): number {
  const outstanding = booking.totalMinor - booking.amountPaidMinor;
  switch (purpose) {
    case 'DEPOSIT':
      if (!['AWAITING_PAYMENT', 'PAYMENT_PENDING'].includes(booking.status)) throw new DomainError('INVALID_TRANSITION', 'A deposit is not due for this booking.');
      return Math.max(booking.depositMinor - booking.amountPaidMinor, 0);
    case 'FULL':
      if (!['AWAITING_PAYMENT', 'PAYMENT_PENDING', 'CONFIRMED'].includes(booking.status)) throw new DomainError('INVALID_TRANSITION', 'Payment is not due for this booking.');
      return outstanding;
    case 'BALANCE':
      if (booking.status !== 'CONFIRMED') throw new DomainError('INVALID_TRANSITION', 'The balance can be paid once the booking is confirmed.');
      return outstanding;
  }
}

/** Create (or return, for a repeated idempotency key) a payment order for a booking. */
export async function startPayment(
  reference: string,
  viewer: Viewer,
  purpose: PaymentPurpose,
  idempotencyKey: string | undefined,
  ctx: RequestContext = {},
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<{ order: PaymentOrder; checkout: CheckoutDescriptor }> {
  const provider = activePaymentProvider();
  if (!provider) {
    throw new DomainError('INTEGRATION_NOT_CONFIGURED', 'Online payment is not available yet. The team will contact you to arrange payment.');
  }
  await expireStaleHolds(db, now);
  const booking = await getBookingForViewer(reference, viewer, db);
  if (booking.holdExpiresAt && booking.holdExpiresAt < now) throw new DomainError('INVALID_TRANSITION', 'The payment window for this booking has expired.');

  const key = (idempotencyKey && /^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey) ? idempotencyKey : null) ?? `auto_${randomBytes(12).toString('hex')}`;
  const existing = await db.paymentOrder.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    if (existing.bookingId !== booking.id) throw new DomainError('CONFLICT', 'Idempotency key already used for a different booking.');
    // An attempt that never reached the provider can't be resumed; the client retries with a new key.
    if (existing.status === 'FAILED' && existing.provider === 'RAZORPAY' && !existing.providerOrderId) {
      throw new DomainError('PAYMENT_ERROR', 'The previous payment attempt could not be started. Please try again.');
    }
    return { order: existing, checkout: await checkoutFor(existing, booking) };
  }

  const amountMinor = amountFor(booking, purpose);
  if (amountMinor <= 0) throw new DomainError('INVALID_TRANSITION', 'Nothing is due for this booking.');

  let order = await db.$transaction(async (tx) => {
    const created = await tx.paymentOrder.create({
      data: { bookingId: booking.id, provider, purpose, amountMinor, currency: booking.currency, idempotencyKey: key, isSimulated: provider === 'DEMO' || razorpayTestMode(), status: 'CREATED' },
    });
    if (booking.status === 'AWAITING_PAYMENT') {
      await transitionBooking({ bookingId: booking.id, to: 'PAYMENT_PENDING', actorType: 'SYSTEM', reason: provider === 'DEMO' ? 'Simulated checkout started' : 'Checkout started' }, tx);
    }
    // Give the customer a short window to complete checkout without losing the slot.
    const minHold = new Date(now.getTime() + 15 * 60_000);
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: booking.amountPaidMinor === 0 ? 'PENDING' : booking.paymentStatus,
        ...(booking.holdExpiresAt && booking.holdExpiresAt < minHold ? { holdExpiresAt: minHold } : {}),
      },
    });
    return created;
  }, TX_OPTIONS);

  if (provider === 'RAZORPAY') {
    try {
      const rp = await createRazorpayOrder(
        { amountMinor, currency: booking.currency, receipt: `${booking.reference}-${order.id.slice(-6)}`, notes: { bookingReference: booking.reference, paymentOrderId: order.id } },
        key,
      );
      order = await db.paymentOrder.update({ where: { id: order.id }, data: { providerOrderId: rp.id, status: 'PENDING' } });
    } catch (err) {
      await db.paymentOrder.update({ where: { id: order.id }, data: { status: 'FAILED', failureReason: (err as Error).message.slice(0, 300) } });
      throw err;
    }
  } else {
    order = await db.paymentOrder.update({ where: { id: order.id }, data: { status: 'PENDING' } });
  }
  await recordAudit(viewer.actor, { action: 'payment.order_created', entityType: 'PaymentOrder', entityId: order.id, summary: `${provider} order for ${booking.reference}`, after: { amountMinor, purpose, isSimulated: order.isSimulated } }, ctx, db);
  return { order, checkout: await checkoutFor(order, booking) };
}

async function checkoutFor(order: PaymentOrder, booking: Booking): Promise<CheckoutDescriptor> {
  if (order.provider === 'DEMO') {
    return { provider: 'DEMO', isSimulated: true, orderId: order.id, amountMinor: order.amountMinor, currency: order.currency };
  }
  const settings = await getAllSettings();
  return {
    provider: 'RAZORPAY',
    isSimulated: false,
    orderId: order.id,
    providerOrderId: order.providerOrderId!,
    keyId: getEnv().RAZORPAY_KEY_ID!,
    amountMinor: order.amountMinor,
    currency: order.currency,
    merchantName: siteContentFor(settings, booking.sourceSite ?? booking.brand).name,
    prefill: { name: booking.contactName, email: booking.contactEmail, contact: booking.contactPhone ?? undefined },
  };
}

export interface ChargeResult {
  providerPaymentId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
  amountMinor: number;
  currency: string;
  failureReason?: string;
  source: string;
}

/**
 * Apply a verified provider result to an order and its booking. Idempotent:
 * replaying the same provider payment id never double-counts money.
 */
export async function recordChargeResult(orderId: string, result: ChargeResult, db: PrismaClient | Tx = prisma) {
  const run = async (tx: Tx) => {
    const order = await tx.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw notFound('Payment order');
    await tx.$executeRaw`SELECT 1 FROM "Booking" WHERE id = ${order.bookingId} FOR UPDATE`;

    const existingTx = await tx.transaction.findUnique({
      where: { provider_providerPaymentId_type: { provider: order.provider, providerPaymentId: result.providerPaymentId, type: 'CHARGE' } },
    });
    if (existingTx && existingTx.status === 'SUCCEEDED') return { order, duplicate: true };

    let status = result.status;
    let failureReason = result.failureReason;
    if (status === 'SUCCEEDED' && (result.amountMinor !== order.amountMinor || result.currency !== order.currency)) {
      status = 'FAILED';
      failureReason = `Amount mismatch: expected ${order.amountMinor} ${order.currency}, provider reported ${result.amountMinor} ${result.currency}.`;
    }

    const txData = {
      status: status === 'SUCCEEDED' ? 'SUCCEEDED' : status === 'FAILED' ? 'FAILED' : 'PENDING',
      amountMinor: result.amountMinor,
      failureReason: failureReason ?? null,
    } as const;
    if (existingTx) {
      await tx.transaction.update({ where: { id: existingTx.id }, data: txData });
    } else {
      await tx.transaction.create({
        data: {
          ...txData,
          bookingId: order.bookingId,
          paymentOrderId: order.id,
          provider: order.provider,
          type: 'CHARGE',
          currency: result.currency,
          providerPaymentId: result.providerPaymentId,
          isSimulated: order.isSimulated,
        },
      });
    }

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: order.bookingId } });
    const verifiedBy = order.provider === 'DEMO' ? 'Simulated demo payment (no money moved)' : `Payment verified via ${result.source}${order.isSimulated ? ' (Razorpay test mode, no real money)' : ''}`;

    if (status === 'SUCCEEDED') {
      const updatedOrder = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'SUCCEEDED', failureReason: null } });
      const paid = booking.amountPaidMinor + result.amountMinor;
      const after = await tx.booking.update({
        where: { id: booking.id },
        data: {
          amountPaidMinor: paid,
          paymentStatus: computePaymentStatus({ ...booking, amountPaidMinor: paid }),
          version: { increment: 1 },
        },
      });
      if ((booking.status === 'AWAITING_PAYMENT' || booking.status === 'PAYMENT_PENDING') && paid >= booking.depositMinor) {
        await transitionBooking({ bookingId: booking.id, to: 'CONFIRMED', actorType: 'SYSTEM', reason: verifiedBy }, tx);
      } else if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
        await recordAudit(null, {
          action: 'payment.received_for_inactive_booking',
          entityType: 'Booking',
          entityId: booking.id,
          summary: `${booking.reference} received a payment after it became ${booking.status}. Review for refund.`,
        }, {}, tx);
      }
      return { order: updatedOrder, booking: after, duplicate: false };
    }

    if (status === 'FAILED') {
      const updatedOrder = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'FAILED', failureReason: failureReason ?? 'Payment failed' } });
      const stillPending = await tx.paymentOrder.count({ where: { bookingId: booking.id, status: 'PENDING', id: { not: order.id } } });
      if (booking.status === 'PAYMENT_PENDING' && stillPending === 0) {
        await transitionBooking({ bookingId: booking.id, to: 'AWAITING_PAYMENT', actorType: 'SYSTEM', reason: `Payment did not complete${order.isSimulated ? ' (simulated failure)' : ''}` }, tx);
      }
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: booking.amountPaidMinor > 0 ? booking.paymentStatus : stillPending ? 'PENDING' : 'FAILED' },
      });
      return { order: updatedOrder, duplicate: false };
    }

    const updatedOrder = await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'PENDING' } });
    return { order: updatedOrder, duplicate: false };
  };
  if ('$transaction' in db) return (db as PrismaClient).$transaction(run, TX_OPTIONS);
  return run(db as Tx);
}

/** Demo mode only: simulate the provider's verdict for a DEMO order. */
export async function simulateDemoPayment(orderId: string, outcome: 'success' | 'failure', viewer: Viewer, ctx: RequestContext = {}, db: PrismaClient = prisma) {
  if (getEnv().PAYMENTS_MODE !== 'demo') throw new DomainError('FORBIDDEN', 'Simulated payments are disabled.');
  const order = await db.paymentOrder.findUnique({ where: { id: orderId }, include: { booking: true } });
  if (!order || order.provider !== 'DEMO') throw notFound('Payment order');
  await getBookingForViewer(order.booking.reference, viewer, db); // authorisation
  if (order.status === 'SUCCEEDED') return { order, duplicate: true };
  if (order.status !== 'PENDING') throw new DomainError('INVALID_TRANSITION', 'This payment can no longer be completed.');
  const result = await recordChargeResult(order.id, {
    providerPaymentId: `demo_pay_${randomBytes(8).toString('hex')}`,
    status: outcome === 'success' ? 'SUCCEEDED' : 'FAILED',
    amountMinor: order.amountMinor,
    currency: order.currency,
    failureReason: outcome === 'failure' ? 'Simulated card decline (demo)' : undefined,
    source: 'demo simulator',
  }, db);
  await recordAudit(viewer.actor, { action: `payment.simulated_${outcome}`, entityType: 'PaymentOrder', entityId: order.id, summary: `Simulated ${outcome} for ${order.booking.reference}` }, ctx, db);
  return result;
}

/**
 * Razorpay checkout callback. The browser-supplied signature is verified, and
 * the payment state is then fetched from Razorpay's API: the redirect itself is
 * never treated as proof of payment.
 */
export async function confirmRazorpayCheckout(
  orderId: string,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  viewer: Viewer,
  db: PrismaClient = prisma,
) {
  const env = getEnv();
  const order = await db.paymentOrder.findUnique({ where: { id: orderId }, include: { booking: true } });
  if (!order || order.provider !== 'RAZORPAY') throw notFound('Payment order');
  await getBookingForViewer(order.booking.reference, viewer, db);
  if (payload.razorpay_order_id !== order.providerOrderId) throw invalid('Payment does not match this order.');
  if (!env.RAZORPAY_KEY_SECRET || !verifyCheckoutSignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature, env.RAZORPAY_KEY_SECRET)) {
    throw new DomainError('PAYMENT_ERROR', 'Payment signature could not be verified.');
  }
  const payment = await fetchRazorpayPayment(payload.razorpay_payment_id);
  if (payment.order_id !== order.providerOrderId) throw new DomainError('PAYMENT_ERROR', 'Payment does not belong to this order.');
  return recordChargeResult(order.id, {
    providerPaymentId: payment.id,
    status: payment.status === 'captured' ? 'SUCCEEDED' : payment.status === 'failed' ? 'FAILED' : 'PENDING',
    amountMinor: payment.amount,
    currency: payment.currency,
    failureReason: payment.error_description ?? undefined,
    source: 'Razorpay API',
  }, db);
}

/**
 * Asks Razorpay for the outcome of a booking's open orders. This covers a
 * customer whose browser never returned from checkout (closed tab, lost
 * connection) when webhooks are not configured. Only captured payments are
 * recorded, using the same checks as every other path; failed attempts leave
 * the order open so the customer can try again.
 */
export async function syncRazorpayPayments(reference: string, viewer: Viewer, db: PrismaClient = prisma) {
  const booking = await getBookingForViewer(reference, viewer, db);
  if (activePaymentProvider() !== 'RAZORPAY') return { checked: 0, recorded: 0 };
  const orders = await db.paymentOrder.findMany({ where: { bookingId: booking.id, provider: 'RAZORPAY', status: 'PENDING', providerOrderId: { not: null } } });
  let recorded = 0;
  for (const order of orders) {
    const captured = (await fetchRazorpayOrderPayments(order.providerOrderId!)).find((p) => p.status === 'captured' && p.order_id === order.providerOrderId);
    if (!captured) continue;
    await recordChargeResult(order.id, { providerPaymentId: captured.id, status: 'SUCCEEDED', amountMinor: captured.amount, currency: captured.currency, source: 'Razorpay API (status check)' }, db);
    recorded += 1;
  }
  return { checked: orders.length, recorded };
}

interface RazorpayWebhookBody {
  event: string;
  payload?: {
    payment?: { entity: { id: string; order_id: string; amount: number; currency: string; status: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
  };
}

/** Handle a Razorpay webhook. Signature-checked against the raw body and de-duplicated by event id. */
export async function handleRazorpayWebhook(rawBody: string, signature: string | undefined, eventIdHeader: string | undefined, db: PrismaClient = prisma) {
  const secret = getEnv().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new DomainError('INTEGRATION_NOT_CONFIGURED', 'Webhook secret not configured.');
  const valid = verifyWebhookSignature(rawBody, signature, secret);
  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    throw invalid('Malformed webhook body.');
  }
  const eventId = eventIdHeader || `${body.event}:${body.payload?.payment?.entity.id ?? body.payload?.refund?.entity.id ?? 'unknown'}`;
  if (!valid) {
    await db.webhookEvent.upsert({
      where: { provider_eventId: { provider: 'RAZORPAY', eventId: `invalid:${eventId}:${Date.now()}` } },
      create: { provider: 'RAZORPAY', eventId: `invalid:${eventId}:${Date.now()}`, eventType: body.event ?? 'unknown', signatureValid: false, payload: redact(body) as Prisma.InputJsonValue, error: 'Invalid signature' },
      update: {},
    });
    throw new DomainError('FORBIDDEN', 'Invalid webhook signature.');
  }

  try {
    await db.webhookEvent.create({ data: { provider: 'RAZORPAY', eventId, eventType: body.event, signatureValid: true, payload: redact(body) as Prisma.InputJsonValue } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const prior = await db.webhookEvent.findUnique({ where: { provider_eventId: { provider: 'RAZORPAY', eventId } } });
      if (prior?.processedAt) return { duplicate: true };
    } else throw err;
  }

  try {
    const payment = body.payload?.payment?.entity;
    if (payment && ['payment.captured', 'payment.failed', 'payment.authorized', 'order.paid'].includes(body.event)) {
      const order = await db.paymentOrder.findUnique({ where: { provider_providerOrderId: { provider: 'RAZORPAY', providerOrderId: payment.order_id } } });
      if (order) {
        await recordChargeResult(order.id, {
          providerPaymentId: payment.id,
          status: payment.status === 'captured' ? 'SUCCEEDED' : payment.status === 'failed' ? 'FAILED' : 'PENDING',
          amountMinor: payment.amount,
          currency: payment.currency,
          failureReason: payment.error_description,
          source: 'Razorpay webhook',
        }, db);
      }
    }
    const refund = body.payload?.refund?.entity;
    if (refund && (body.event === 'refund.processed' || body.event === 'refund.failed')) {
      const record = await db.refund.findFirst({ where: { providerRefundId: refund.id } });
      if (record) await finaliseRefund(record.id, body.event === 'refund.processed', db);
    }
    await db.webhookEvent.update({ where: { provider_eventId: { provider: 'RAZORPAY', eventId } }, data: { processedAt: new Date() } });
    return { duplicate: false };
  } catch (err) {
    await db.webhookEvent.update({ where: { provider_eventId: { provider: 'RAZORPAY', eventId } }, data: { error: (err as Error).message.slice(0, 500) } });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export async function issueRefund(transactionId: string, amountMinor: number, reason: string, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw invalid('Refund amount must be a positive amount.');
  if (!reason || reason.trim().length < 3) throw invalid('A refund reason is required.');

  const refund = await db.$transaction(async (tx) => {
    const charge = await tx.transaction.findUnique({ where: { id: transactionId }, include: { refunds: true } });
    if (!charge || charge.type !== 'CHARGE' || charge.status !== 'SUCCEEDED') throw invalid('Only successful charges can be refunded.');
    await tx.$executeRaw`SELECT 1 FROM "Booking" WHERE id = ${charge.bookingId} FOR UPDATE`;
    const alreadyRefunded = charge.refunds.filter((r) => r.status !== 'FAILED').reduce((s, r) => s + r.amountMinor, 0);
    if (amountMinor > charge.amountMinor - alreadyRefunded) throw invalid('Refund exceeds the refundable amount for this charge.');
    return tx.refund.create({
      data: { bookingId: charge.bookingId, transactionId: charge.id, amountMinor, reason: reason.trim(), isSimulated: charge.isSimulated, createdById: actor.userId, status: 'REQUESTED' },
      include: { transaction: true },
    });
  }, TX_OPTIONS);

  await recordAudit(actor, { action: 'refund.requested', entityType: 'Refund', entityId: refund.id, summary: `Refund of ${amountMinor} requested${refund.isSimulated ? ' (simulated)' : ''}`, after: { amountMinor, reason } }, ctx, db);

  // Demo refunds complete locally; Razorpay refunds (live or test mode) go through the provider.
  if (refund.transaction.provider === 'DEMO') return finaliseRefund(refund.id, true, db);

  try {
    const rp = await createRazorpayRefund(refund.transaction.providerPaymentId!, amountMinor, `refund_${refund.id}`);
    const pending = await db.refund.update({ where: { id: refund.id }, data: { status: 'PENDING', providerRefundId: rp.id } });
    // Razorpay usually reports refunds as processed straight away; otherwise the refund.processed webhook completes it.
    return rp.status === 'processed' ? finaliseRefund(refund.id, true, db) : pending;
  } catch (err) {
    await db.refund.update({ where: { id: refund.id }, data: { status: 'FAILED' } });
    throw err;
  }
}

/** Completes pending Razorpay refunds that the provider has since processed or failed (when webhooks are not configured). */
export async function syncPendingRefunds(db: PrismaClient = prisma) {
  if (activePaymentProvider() !== 'RAZORPAY') return { checked: 0, updated: 0 };
  const pending = await db.refund.findMany({ where: { status: 'PENDING', providerRefundId: { not: null }, transaction: { provider: 'RAZORPAY' } }, take: 50 });
  let updated = 0;
  for (const r of pending) {
    const remote = await fetchRazorpayRefund(r.providerRefundId!);
    if (remote.status === 'pending') continue;
    await finaliseRefund(r.id, remote.status === 'processed', db);
    updated += 1;
  }
  return { checked: pending.length, updated };
}

async function finaliseRefund(refundId: string, succeeded: boolean, db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId }, include: { transaction: true } });
    if (refund.status === 'SUCCEEDED' || refund.status === 'FAILED') return refund;
    if (!succeeded) return tx.refund.update({ where: { id: refundId }, data: { status: 'FAILED' } });
    await tx.$executeRaw`SELECT 1 FROM "Booking" WHERE id = ${refund.bookingId} FOR UPDATE`;
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: refund.bookingId } });
    const refunded = booking.amountRefundedMinor + refund.amountMinor;
    await tx.booking.update({
      where: { id: booking.id },
      data: { amountRefundedMinor: refunded, paymentStatus: computePaymentStatus({ ...booking, amountRefundedMinor: refunded }) },
    });
    await tx.transaction.create({
      data: {
        bookingId: booking.id,
        provider: refund.transaction.provider,
        type: 'REFUND',
        status: 'SUCCEEDED',
        amountMinor: refund.amountMinor,
        currency: refund.transaction.currency,
        providerPaymentId: refund.providerRefundId ?? `demo_rfnd_${refund.id}`,
        isSimulated: refund.isSimulated,
      },
    });
    return tx.refund.update({ where: { id: refundId }, data: { status: 'SUCCEEDED', providerRefundId: refund.providerRefundId ?? `demo_rfnd_${refund.id}` } });
  }, TX_OPTIONS);
}
