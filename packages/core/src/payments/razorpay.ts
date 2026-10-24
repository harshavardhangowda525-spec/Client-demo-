import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../env';
import { DomainError } from '../errors';

const API = 'https://api.razorpay.com/v1';

export function razorpayConfigured(): boolean {
  const env = getEnv();
  return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const env = getEnv();
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new DomainError('INTEGRATION_NOT_CONFIGURED', 'Razorpay credentials are not configured.');
  }
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    throw new DomainError('PAYMENT_ERROR', `Payment provider error: ${body.error?.description ?? `HTTP ${res.status}`}`);
  }
  return body;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  error_description?: string | null;
}

export function createRazorpayOrder(params: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }, idempotencyKey: string) {
  return call<RazorpayOrder>('/orders', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ amount: params.amountMinor, currency: params.currency, receipt: params.receipt.slice(0, 40), notes: params.notes }),
  });
}

export function fetchRazorpayPayment(paymentId: string) {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new DomainError('VALIDATION', 'Invalid payment reference.');
  return call<RazorpayPayment>(`/payments/${paymentId}`);
}

export function createRazorpayRefund(paymentId: string, amountMinor: number, idempotencyKey: string) {
  return call<{ id: string; status: string }>(`/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { 'X-Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ amount: amountMinor }),
  });
}

export async function verifyRazorpayCredentials(): Promise<{ ok: boolean; message: string }> {
  try {
    await call('/orders?count=1');
    return { ok: true, message: 'Authenticated with the Razorpay API.' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout callback signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw request body, webhook secret). Must use the unparsed body. */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
