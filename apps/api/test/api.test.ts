import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@studio/db';
import { addDays, formatLocalDate, localDayOfWeek, todayIn } from '@studio/core';
import { cookieHeader, json, PASSWORDS, setup, signIn, SITE } from './helpers';

let app: FastifyInstance;
const cookies: Record<string, string> = {};
let multicamId = '';
let bomId = '';

function weekday(offset: number) {
  let d = addDays(todayIn('Asia/Kolkata'), offset);
  while ([0, 6].includes(localDayOfWeek(d, 'Asia/Kolkata'))) d = addDays(d, 1);
  return formatLocalDate(d);
}

beforeAll(async () => {
  app = await setup();
  for (const [role, [email, pw]] of Object.entries(PASSWORDS)) cookies[role] = await signIn(app, email, pw);
  multicamId = (await prisma.service.findFirstOrThrow({ where: { slug: 'multi-camera-sessions' } })).id;
  bomId = (await prisma.location.findUniqueOrThrow({ where: { slug: 'mumbai-studio-demo' } })).id;
});
afterAll(async () => {
  await app.close();
});

const post = (url: string, payload: unknown, cookie?: string, origin: string | null = SITE, extra: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), ...extra } });
const get = (url: string, cookie?: string, extra: Record<string, string> = {}) => app.inject({ method: 'GET', url, headers: { ...(cookie ? { cookie } : {}), ...extra } });

const bookingBody = (offset: number, email = 'api-guest@test.example') => ({
  brand: 'PODCAST', serviceId: multicamId, locationId: bomId, date: weekday(offset), startTime: '10:00',
  contact: { name: 'API Guest', email }, acceptTerms: true,
});

describe('public API', () => {
  it('serves site config, catalogue, locations, FAQs and the OpenAPI document', async () => {
    expect(json(await get('/api/v1/sites/PHOTO')).site.name).toBe('Lumen Studio');
    expect(json(await get('/api/v1/sites/EVENTS/catalog')).services.length).toBeGreaterThan(3);
    expect(json(await get('/api/v1/sites/PODCAST/locations')).length).toBe(2);
    expect((await get('/api/v1/sites/NOPE')).statusCode).toBe(400);
    const doc = json(await get('/api/openapi.json'));
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toContain('/api/v1/bookings');
  });

  it('quotes ignore any client-supplied price', async () => {
    const res = await post('/api/v1/quotes', { serviceId: multicamId, totalMinor: 1, priceMinor: 1 });
    expect(res.statusCode).toBe(200);
    expect(json(res).totalMinor).toBe(1_444_320); // 12,000 + 2% sample fee + 18% sample tax
  });

  it('returns structured validation errors', async () => {
    const res = await post('/api/v1/bookings', { ...bookingBody(10), contact: { name: 'A', email: 'not-an-email' } });
    expect(res.statusCode).toBe(400);
    const err = json(res).error;
    expect(err.code).toBe('VALIDATION');
    expect(err.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['contact.name', 'contact.email']));
  });

  it('creates a guest booking, then only the token holder can view it', async () => {
    const res = await post('/api/v1/bookings', bookingBody(11));
    expect(res.statusCode).toBe(201);
    const { booking, accessToken } = json(res);
    expect(booking.status).toBe('AWAITING_PAYMENT');
    expect(booking).not.toHaveProperty('resourceId');
    expect(booking).not.toHaveProperty('accessTokenHash');

    expect((await get(`/api/v1/bookings/${booking.reference}`)).statusCode).toBe(404);
    expect((await get(`/api/v1/bookings/${booking.reference}`, cookies.customer)).statusCode).toBe(404);
    expect((await get(`/api/v1/bookings/${booking.reference}`, undefined, { 'x-booking-token': 'guess' })).statusCode).toBe(404);
    expect((await get(`/api/v1/bookings/${booking.reference}`, undefined, { 'x-booking-token': accessToken })).statusCode).toBe(200);
    expect((await get(`/api/v1/bookings/${booking.reference}`, cookies.staff)).statusCode).toBe(200);

    const lookup = await post('/api/v1/bookings/lookup', { reference: booking.reference, email: 'api-guest@test.example' });
    expect(json(lookup).status).toBe('AWAITING_PAYMENT');
    expect(json(lookup)).not.toHaveProperty('contact');
    expect((await post('/api/v1/bookings/lookup', { reference: booking.reference, email: 'x@test.example' })).statusCode).toBe(404);
  });

  it('runs the simulated checkout and labels it as simulated', async () => {
    const { booking, accessToken } = json(await post('/api/v1/bookings', bookingBody(12)));
    const h = { 'x-booking-token': accessToken, 'idempotency-key': 'api-test-key-0001' };
    const start = await post(`/api/v1/bookings/${booking.reference}/payments`, { purpose: 'DEPOSIT' }, undefined, SITE, h);
    expect(start.statusCode).toBe(200);
    const { orderId, checkout } = json(start);
    expect(checkout.provider).toBe('DEMO');
    expect(checkout.isSimulated).toBe(true);
    const sim = await post(`/api/v1/payments/demo/${orderId}/simulate`, { outcome: 'success' }, undefined, SITE, { 'x-booking-token': accessToken });
    expect(sim.statusCode).toBe(200);
    expect(json(sim).simulated).toBe(true);
    expect(json(sim).booking.status).toBe('CONFIRMED');
    expect(json(sim).booking.payments[0].isSimulated).toBe(true);
  });

  it('accepts enquiries without creating bookings', async () => {
    const before = await prisma.booking.count();
    const res = await post('/api/v1/enquiries', {
      eventType: 'Product launch', preferredDate: weekday(40), expectedAttendance: 60, contact: { name: 'Launch Lead', email: 'launch@test.example' }, acceptTerms: true,
    });
    expect(res.statusCode).toBe(201);
    expect(json(res).status).toBe('SUBMITTED');
    expect(await prisma.booking.count()).toBe(before);
  });

  it('rejects webhooks with invalid signatures and accepts signed ones', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_X', order_id: 'order_unknown', amount: 100, currency: 'INR', status: 'captured' } } } });
    const bad = await app.inject({ method: 'POST', url: '/api/v1/webhooks/razorpay', payload: body, headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'nope' } });
    expect(bad.statusCode).toBe(403);
    const sig = createHmac('sha256', 'test_webhook_secret').update(body).digest('hex');
    const good = await app.inject({ method: 'POST', url: '/api/v1/webhooks/razorpay', payload: body, headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_api_1' } });
    expect(good.statusCode).toBe(200);
  });
});

describe('authentication and authorization', () => {
  it('sign-up cannot assign a privileged role', async () => {
    const res = await post('/api/auth/sign-up/email', { name: 'Eve Example', email: 'eve@test.example', password: 'correct-horse-battery', role: 'admin' });
    expect([200, 400, 422]).toContain(res.statusCode);
    const user = await prisma.user.findUnique({ where: { email: 'eve@test.example' } });
    if (user) expect(user.role).toBe('customer');
    if (user) expect(await prisma.customerProfile.findUnique({ where: { userId: user.id } })).not.toBeNull();
  });

  it('requires sign-in for account routes', async () => {
    expect((await get('/api/v1/me')).statusCode).toBe(401);
    expect((await get('/api/v1/admin/dashboard')).statusCode).toBe(401);
  });

  it('blocks customers from every admin route', async () => {
    for (const url of ['/api/v1/admin/dashboard', '/api/v1/admin/bookings', '/api/v1/admin/customers', '/api/v1/admin/settings', '/api/v1/admin/audit', '/api/v1/admin/payments']) {
      expect((await get(url, cookies.customer)).statusCode, url).toBe(403);
    }
  });

  it('enforces role permissions: staff, manager, admin', async () => {
    expect((await get('/api/v1/admin/bookings', cookies.staff)).statusCode).toBe(200);
    expect((await get('/api/v1/admin/audit', cookies.staff)).statusCode).toBe(403);
    expect((await get('/api/v1/admin/users', cookies.staff)).statusCode).toBe(403);
    expect((await get('/api/v1/admin/audit', cookies.manager)).statusCode).toBe(200);
    const pricing = json(await get('/api/v1/admin/settings', cookies.admin)).pricing;
    expect((await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/pricing', payload: pricing, headers: { cookie: cookies.manager, origin: SITE } })).statusCode).toBe(403);
    const ok = await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/pricing', payload: { ...pricing, depositBps: 2500 }, headers: { cookie: cookies.admin, origin: SITE } });
    expect(ok.statusCode).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'settings.updated' } })).toBe(1);
    await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/pricing', payload: pricing, headers: { cookie: cookies.admin, origin: SITE } });
  });

  it('staff cannot refund; refunds need payments.refund', async () => {
    const tx = await prisma.transaction.findFirst({ where: { type: 'CHARGE', status: 'SUCCEEDED' } });
    expect(tx).not.toBeNull();
    const res = await post(`/api/v1/admin/transactions/${tx!.id}/refund`, { amountMinor: 100, reason: 'test' }, cookies.staff);
    expect(res.statusCode).toBe(403);
  });

  it('rejects cookie-authenticated writes from foreign origins (CSRF)', async () => {
    const evil = await post('/api/v1/admin/bookings/x/notes', { body: 'hi' }, cookies.admin, 'https://evil.example');
    expect(evil.statusCode).toBe(403);
    expect(json(evil).error.message).toMatch(/origin/);
    const noOrigin = await post('/api/v1/me/profile', { fullName: 'X' }, cookies.customer, null);
    expect(noOrigin.statusCode).toBe(403);
  });

  it('customers only ever see their own bookings', async () => {
    const own = await post('/api/v1/bookings', bookingBody(13, 'customer@demo.example'), cookies.customer);
    expect(own.statusCode).toBe(201);
    await post('/api/v1/bookings', bookingBody(14, 'someone-else@test.example'));
    const mine = json(await get('/api/v1/me/bookings', cookies.customer));
    expect(mine.map((b: { reference: string }) => b.reference)).toEqual([json(own).booking.reference]);
  });

  it('admins cannot change their own role', async () => {
    const me = json(await get('/api/v1/me', cookies.admin));
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${me.user.id}`, payload: { role: 'customer' }, headers: { cookie: cookies.admin, origin: SITE } });
    expect(res.statusCode).toBe(403);
  });

  it('deactivating a user revokes their sessions', async () => {
    const staffUser = await prisma.user.findUniqueOrThrow({ where: { email: 'staff@demo.example' } });
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${staffUser.id}`, payload: { isActive: false }, headers: { cookie: cookies.admin, origin: SITE } });
    expect(res.statusCode).toBe(200);
    expect((await get('/api/v1/admin/bookings', cookies.staff)).statusCode).toBe(401);
    await prisma.user.update({ where: { id: staffUser.id }, data: { isActive: true } });
  });

  it('sign-out ends the session', async () => {
    const c = await signIn(app, ...PASSWORDS.customer);
    const out = await post('/api/auth/sign-out', {}, c);
    expect(out.statusCode).toBe(200);
    expect(cookieHeader(out)).toContain('studio.session_token=');
    expect((await get('/api/v1/me', c)).statusCode).toBe(401);
  });
});
