import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@studio/db';
import { addDays, formatLocalDate, localDayOfWeek, todayIn } from '@studio/core';
import { json, PASSWORDS, setup, signIn, SITE } from './helpers';

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'api-uploads-'));
let app: FastifyInstance;
const cookies: Record<string, string> = {};

function weekday(offset: number) {
  let d = addDays(todayIn('Asia/Kolkata'), offset);
  while ([0, 6].includes(localDayOfWeek(d, 'Asia/Kolkata'))) d = addDays(d, 1);
  return formatLocalDate(d);
}

beforeAll(async () => {
  app = await setup();
  for (const [role, [email, pw]] of Object.entries(PASSWORDS)) cookies[role] = await signIn(app, email, pw);
});
afterAll(async () => {
  await app.close();
});

const get = (url: string, cookie?: string) => app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
const send = (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload: unknown, cookie?: string, extra: Record<string, string> = {}) =>
  app.inject({ method, url, payload: payload as object, headers: { ...(payload !== undefined ? { 'content-type': 'application/json' } : {}), origin: SITE, ...(cookie ? { cookie } : {}), ...extra } });

function multipart(filename: string, content: Buffer, type = 'application/pdf') {
  const boundary = '----studiotest' + Date.now();
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('studio discovery API', () => {
  it('serves home, search, listing and detail from real records', async () => {
    const home = json(await get('/api/v1/studio/home'));
    expect(home.banners.length).toBeGreaterThan(0);
    expect(home.site.name).toContain('demo');
    expect(json(await get('/api/v1/studio/search?q=podcast')).services.length).toBeGreaterThan(0);
    const listing = json(await get('/api/v1/studio/services?category=photography&sort=price_asc&pageSize=3'));
    expect(listing.items.length).toBeLessThanOrEqual(3);
    expect(listing.total).toBeGreaterThan(3);
    expect((await get('/api/v1/studio/services?sort=bogus')).statusCode).toBe(400);
    expect(json(await get('/api/v1/studio/services/product-photography')).name).toBe('Product photography');
    expect((await get('/api/v1/studio/services/corporate-event-management')).statusCode).toBe(404);
    expect(json(await get('/api/v1/studio/pages/cancellation-refund')).isTemplate).toBe(true);
  });

  it('bookings made on the studio site link back to it in notifications', async () => {
    const svc = await prisma.service.findFirstOrThrow({ where: { slug: 'multi-camera-sessions' } });
    const loc = await prisma.location.findUniqueOrThrow({ where: { slug: 'mumbai-studio-demo' } });
    const res = await send('POST', '/api/v1/bookings', { brand: 'PODCAST', sourceSite: 'STUDIO', serviceId: svc.id, locationId: loc.id, date: weekday(9), startTime: '10:00', contact: { name: 'Studio Guest', email: 'studio-guest@test.example' }, acceptTerms: true });
    expect(res.statusCode).toBe(201);
    const { booking, accessToken } = json(res);
    expect(booking.sourceSite).toBe('STUDIO');
    await new Promise((r) => setTimeout(r, 300)); // fire-and-forget notification
    const n = await prisma.notification.findFirstOrThrow({ where: { template: 'booking.received', recipient: 'studio-guest@test.example' } });
    expect(n.body).toContain('http://localhost:3004/booking-status');
    expect(n.subject).toContain(booking.reference);
    expect(await prisma.notification.count({ where: { template: 'staff.new_booking' } })).toBeGreaterThan(0);

    // Reschedule request by the token holder, decided by staff.
    const r = await send('POST', `/api/v1/bookings/${booking.reference}/reschedule-requests`, { date: weekday(9), startTime: '15:00', reason: 'Clash' }, undefined, { 'x-booking-token': accessToken });
    expect(r.statusCode).toBe(201);
    const view = json(await app.inject({ method: 'GET', url: `/api/v1/bookings/${booking.reference}`, headers: { 'x-booking-token': accessToken } }));
    expect(view.actions.canRequestReschedule).toBe(false);
    expect(view.rescheduleRequests[0].status).toBe('PENDING');
    const id = json(r).id;
    expect((await send('POST', `/api/v1/admin/reschedule-requests/${id}/decide`, { approve: true }, cookies.customer)).statusCode).toBe(403);
    const ok = await send('POST', `/api/v1/admin/reschedule-requests/${id}/decide`, { approve: true, note: 'Moved' }, cookies.staff);
    expect(ok.statusCode).toBe(200);
  });
});

describe('project briefs and attachments', () => {
  it('stores a brief, accepts a real PDF from the token holder and lets only staff download it', async () => {
    const svc = await prisma.service.findFirstOrThrow({ where: { slug: 'brand-and-advertising-shoots' } });
    const res = await send('POST', '/api/v1/studio/enquiries', {
      eventType: 'Brand campaign', preferredDate: weekday(30), expectedAttendance: 1, serviceIds: [svc.id], companyName: 'Sample Co', deliverables: 4,
      contact: { name: 'Brief Sender', email: 'brief@test.example' }, acceptTerms: true,
    });
    expect(res.statusCode).toBe(201);
    const { reference, accessToken } = json(res);
    const enquiry = await prisma.eventEnquiry.findUniqueOrThrow({ where: { reference } });
    expect(enquiry.brand).toBe('PHOTO');
    expect(enquiry.sourceSite).toBe('STUDIO');

    const pdf = multipart('brief.pdf', Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 1)]));
    const upload = (token: string, part = pdf) => app.inject({ method: 'POST', url: `/api/v1/enquiries/${reference}/attachments`, payload: part.body, headers: { 'content-type': part.contentType, 'x-booking-token': token } });
    expect((await upload('wrong')).statusCode).toBe(404);
    expect((await upload(accessToken, multipart('x.pdf', Buffer.from('not really a pdf'), 'application/pdf'))).statusCode).toBe(400);
    const ok = await upload(accessToken);
    expect(ok.statusCode).toBe(201);
    const att = json(ok);

    expect((await get(`/api/v1/admin/attachments/${att.id}`)).statusCode).toBe(401);
    expect((await get(`/api/v1/admin/attachments/${att.id}`, cookies.customer)).statusCode).toBe(403);
    const dl = await get(`/api/v1/admin/attachments/${att.id}`, cookies.staff);
    expect(dl.statusCode).toBe(200);
    expect(dl.headers['content-disposition']).toContain('attachment;');
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    expect(dl.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('account and content administration', () => {
  it('saved services and preferences require sign-in', async () => {
    const svc = await prisma.service.findFirstOrThrow({ where: { slug: 'audio-recording' } });
    expect((await get('/api/v1/me/saved')).statusCode).toBe(401);
    expect((await send('PUT', `/api/v1/me/saved/${svc.id}`, {}, cookies.customer)).statusCode).toBe(200);
    expect(json(await get('/api/v1/me/saved', cookies.customer)).map((s: { id: string }) => s.id)).toContain(svc.id);
    expect((await send('PATCH', '/api/v1/me/preferences', { notifyEmail: true, notifyWhatsapp: true }, cookies.customer)).statusCode).toBe(400);
    expect((await send('PATCH', '/api/v1/me/preferences', { notifyEmail: true, notifyWhatsapp: true, whatsappConsent: true }, cookies.customer)).statusCode).toBe(200);
  });

  it('enforces permissions on studio content, equipment and templates', async () => {
    const banner = { title: 'New banner', imageKey: 'photo-hero', imageAlt: 'Photographer in studio', ctaLabel: 'Explore', ctaHref: '/services/photography' };
    expect((await send('POST', '/api/v1/admin/banners', banner, cookies.customer)).statusCode).toBe(403);
    expect((await send('POST', '/api/v1/admin/banners', { ...banner, ctaHref: 'javascript:alert(1)' }, cookies.staff)).statusCode).toBe(400);
    expect((await send('POST', '/api/v1/admin/banners', banner, cookies.staff)).statusCode).toBe(201);
    expect((await send('POST', '/api/v1/admin/equipment', { name: 'Light', category: 'Lighting' }, cookies.staff)).statusCode).toBe(403); // catalog.manage
    expect((await send('POST', '/api/v1/admin/equipment', { name: 'Light', category: 'Lighting' }, cookies.manager)).statusCode).toBe(201);
    expect((await get('/api/v1/admin/templates', cookies.manager)).statusCode).toBe(200);
    expect((await send('PUT', '/api/v1/admin/templates/contact.received', { subject: 'Hi {{name}}', body: 'Hello {{name}}' }, cookies.manager)).statusCode).toBe(403);
    expect((await send('PUT', '/api/v1/admin/templates/contact.received', { subject: 'Hi {{name}}', body: 'Hello {{name}}' }, cookies.admin)).statusCode).toBe(200);
    expect((await send('DELETE', '/api/v1/admin/templates/contact.received', undefined, cookies.admin)).statusCode).toBe(200);
  });
});
