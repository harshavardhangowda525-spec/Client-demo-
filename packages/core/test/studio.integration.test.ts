import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@studio/db';
import { createBooking } from '../src/booking/service';
import { decideReschedule, requestReschedule } from '../src/booking/reschedule-requests';
import { getAvailability } from '../src/availability/service';
import { createEnquiry } from '../src/enquiry/service';
import { saveEnquiryAttachment } from '../src/enquiry/attachments';
import { quoteService } from '../src/pricing/service';
import { getStudioHome, getStudioService, listStudioServices, searchStudio } from '../src/studio/catalog';
import { saveTemplate, upsertTestimonial } from '../src/studio/admin';
import { setSavedService, listSavedServices, updateNotificationPreferences } from '../src/studio/customer';
import { sendUpcomingReminders } from '../src/booking/notify';
import { notify } from '../src/notifications/service';
import { studioListingQuerySchema } from '../src/schemas';
import { updateSetting, getSetting } from '../src/settings';
import { actor, futureWeekday, guest, ids, resetDatabase } from './helpers';

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'studio-uploads-'));

let I: Awaited<ReturnType<typeof ids>>;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Booking", "RescheduleRequest", "Notification", "PaymentOrder", "Transaction", "AuditLog" CASCADE');
});

const list = (q: Record<string, unknown>) => listStudioServices(studioListingQuerySchema.parse(q));

describe('studio discovery', () => {
  it('home data comes from records: banners, categories, popular services with real next availability', async () => {
    const home = await getStudioHome();
    expect(home.banners.length).toBeGreaterThan(0);
    expect(home.banners.every((b) => !b.offerText)).toBe(true); // no invented offers
    expect(home.categories.find((c) => c.slug === 'podcasting')!.serviceCount).toBeGreaterThan(0);
    expect(home.testimonials).toEqual([]); // none supplied → section hidden
    expect(home.popular.every((s) => s.brand === 'PHOTO' || s.brand === 'PODCAST')).toBe(true);
    const withSlot = home.popular.find((s) => s.nextAvailable)!;
    const svc = await prisma.service.findFirstOrThrow({ where: { id: withSlot.id }, include: { packages: true, locations: { include: { location: true } } } });
    const loc = svc.locations.find((l) => l.location.city === withSlot.nextAvailable!.city)!;
    const pkg = svc.packages.find((p) => p.isFeatured) ?? svc.packages[0];
    const a = await getAvailability({ serviceId: svc.id, locationId: loc.locationId, date: withSlot.nextAvailable!.date, packageId: pkg?.id, durationMin: pkg ? null : svc.minDurationMin });
    expect(a.days[0]!.slots.map((s) => s.startTime)).toContain(withSlot.nextAvailable!.startTime);
    // Quote-only services never show an availability indicator.
    const quote = (await list({ type: 'quote' })).items;
    expect(quote.length).toBeGreaterThan(0);
    expect(quote.every((s) => s.nextAvailable === null && s.fromPriceMinor === null)).toBe(true);
  });

  it('search returns real services matching every word; event services never appear', async () => {
    const r = await searchStudio('podcast recording');
    expect(r.services.length).toBeGreaterThan(0);
    for (const s of r.services) expect(`${s.name} ${s.summary} ${s.categories.map((c) => c.name).join(' ')}`.toLowerCase()).toMatch(/podcast|record/);
    expect((await searchStudio('corporate event management')).services).toEqual([]);
    expect((await searchStudio('x')).services).toEqual([]);
    expect((await searchStudio('microphones')).services.length).toBeGreaterThan(0); // via equipment
  });

  it('filters, sorts and paginates listings', async () => {
    const rental = await list({ category: 'studio-rental', sort: 'price_asc' });
    expect(rental.category!.name).toBe('Studio Rental');
    const prices = rental.items.map((i) => i.fromPriceMinor!);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const mumbai = await list({ city: 'Mumbai' });
    expect(mumbai.items.every((i) => i.cities.includes('Mumbai'))).toBe(true);
    const cheap = await list({ maxPrice: 300_000 });
    expect(cheap.items.every((i) => i.fromPriceMinor !== null && i.fromPriceMinor <= 300_000)).toBe(true);
    const p1 = await list({ pageSize: 4, page: 1, sort: 'name' });
    const p2 = await list({ pageSize: 4, page: 2, sort: 'name' });
    expect(p1.items).toHaveLength(4);
    expect(p1.items.map((i) => i.id)).not.toEqual(expect.arrayContaining(p2.items.map((i) => i.id)));
    expect(p1.total).toBe(p2.total);
    const dated = await list({ date: futureWeekday(5) });
    expect(dated.items.every((i) => i.bookingMode !== 'ENQUIRY')).toBe(true);
    await expect(list({ category: 'nope' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(rental.facets.cities).toEqual(['Bengaluru', 'Mumbai']);
  });

  it('service detail includes packages, equipment, locations and related services; event services are not exposed', async () => {
    const d = await getStudioService('portrait-photography');
    expect(d.packages.length).toBe(2);
    expect(d.equipment.every((e) => e.isVerified === false)).toBe(true);
    expect(d.related.length).toBeGreaterThan(0);
    expect(d.locations[0]!.openingHours.length).toBeGreaterThan(0);
    await expect(getStudioService('corporate-event-management')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('booking rules for the studio platform', () => {
  it('a per-service deposit override changes the deposit', async () => {
    await prisma.service.update({ where: { id: I.multicam }, data: { depositBpsOverride: 10_000 } });
    const q = await quoteService({ serviceId: I.multicam });
    expect(q.breakdown.depositMinor).toBe(q.breakdown.totalMinor);
    await prisma.service.update({ where: { id: I.multicam }, data: { depositBpsOverride: null } });
  });

  it('enforces the maximum number of active bookings per customer', async () => {
    const rules = await getSetting('bookingRules');
    await updateSetting('bookingRules', { ...rules, maxActiveBookingsPerCustomer: 1 }, null);
    const body = (offset: number) => ({ brand: 'PODCAST', serviceId: I.multicam, locationId: I.bom, date: futureWeekday(offset), startTime: '10:00', contact: guest('limit@test.example'), acceptTerms: true });
    await createBooking(body(10), null);
    await expect(createBooking(body(11), null)).rejects.toMatchObject({ code: 'CONFLICT' });
    await updateSetting('bookingRules', rules, null);
  });

  it('reschedule requests keep the original slot until approved, then move it', async () => {
    const admin = await actor('admin@demo.example');
    const date = futureWeekday(12);
    const { booking, accessToken } = await createBooking({ brand: 'PODCAST', serviceId: I.multicam, locationId: I.bom, date, startTime: '10:00', contact: guest('move@test.example'), acceptTerms: true }, null);
    const viewer = { actor: null, accessToken };
    await expect(requestReschedule(booking.reference, viewer, { date, startTime: '10:00' })).rejects.toThrow(/different time/);
    await expect(requestReschedule(booking.reference, viewer, { date, startTime: '20:00' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    const req = await requestReschedule(booking.reference, viewer, { date, startTime: '15:00', reason: 'Guest delayed' });
    expect(req.status).toBe('PENDING');
    await expect(requestReschedule(booking.reference, viewer, { date, startTime: '17:00' })).rejects.toMatchObject({ code: 'CONFLICT' });
    // Original slot is still reserved.
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).startsAt.toISOString()).toBe(new Date(`${date}T10:00:00+05:30`).toISOString());
    await decideReschedule(req.id, true, 'OK', admin);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).startsAt.toISOString()).toBe(new Date(`${date}T15:00:00+05:30`).toISOString());
    await expect(decideReschedule(req.id, false, undefined, admin)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    // Other people cannot request changes.
    await expect(requestReschedule(booking.reference, { actor: null, accessToken: 'nope' }, { date, startTime: '17:00' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reschedule requests respect the cutoff', async () => {
    const rules = await getSetting('bookingRules');
    await updateSetting('bookingRules', { ...rules, rescheduleRequestCutoffHours: 24 * 60 }, null);
    const { booking, accessToken } = await createBooking({ brand: 'PODCAST', serviceId: I.multicam, locationId: I.bom, date: futureWeekday(13), startTime: '10:00', contact: guest('cutoff@test.example'), acceptTerms: true }, null);
    await expect(requestReschedule(booking.reference, { actor: null, accessToken }, { date: futureWeekday(13), startTime: '15:00' })).rejects.toThrow(/at least/);
    await updateSetting('bookingRules', rules, null);
  });
});

describe('project enquiries and attachments', () => {
  const brief = (over: Record<string, unknown> = {}) => ({
    eventType: 'Product launch film',
    preferredDate: futureWeekday(30),
    expectedAttendance: 1,
    serviceIds: [I.corporateVideo],
    companyName: 'Sample Co',
    expectedDuration: '2 days',
    deliverables: 3,
    contact: guest('brief@test.example'),
    acceptTerms: true,
    ...over,
  });

  it('accepts photo-brand project enquiries and rejects services from other websites', async () => {
    const { enquiry } = await createEnquiry(brief(), null, {}, prisma, new Date(), 'PHOTO', 'STUDIO');
    expect(enquiry.brand).toBe('PHOTO');
    expect(enquiry.sourceSite).toBe('STUDIO');
    expect(enquiry.deliverables).toBe(3);
    await expect(createEnquiry(brief({ serviceIds: [I.corporateEvents] }), null, {}, prisma, new Date(), 'PHOTO')).rejects.toThrow(/unavailable/);
  });

  it('stores only real PDF/image files, within limits, for the token holder', async () => {
    const { enquiry, accessToken } = await createEnquiry(brief(), null, {}, prisma, new Date(), 'PHOTO', 'STUDIO');
    const viewer = { actor: null, accessToken };
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 1)]);
    const saved = await saveEnquiryAttachment(enquiry.reference, viewer, { filename: '../../etc/brief.pdf', data: pdf });
    expect(saved.fileName).toBe('brief.pdf');
    expect(saved.mimeType).toBe('application/pdf');
    await expect(saveEnquiryAttachment(enquiry.reference, viewer, { filename: 'evil.pdf', data: Buffer.from('<script>alert(1)</script>') })).rejects.toThrow(/Only PDF/);
    await expect(saveEnquiryAttachment(enquiry.reference, { actor: null, accessToken: 'wrong' }, { filename: 'a.pdf', data: pdf })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(saveEnquiryAttachment(enquiry.reference, viewer, { filename: 'big.pdf', data: Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]) })).rejects.toThrow(/10 MB/);
    for (let i = 0; i < 4; i++) await saveEnquiryAttachment(enquiry.reference, viewer, { filename: `f${i}.pdf`, data: pdf });
    await expect(saveEnquiryAttachment(enquiry.reference, viewer, { filename: 'six.pdf', data: pdf })).rejects.toThrow(/up to 5/);
  });
});

describe('content, preferences and notifications', () => {
  it('testimonials cannot be published without authorisation', async () => {
    const admin = await actor('admin@demo.example');
    await expect(upsertTestimonial(null, { quote: 'Lovely studio, great team.', authorName: 'A Customer', isPublished: true, isAuthorized: false }, admin)).rejects.toThrow(/authorised/);
    const ok = await upsertTestimonial(null, { quote: 'Lovely studio, great team.', authorName: 'A Customer', isPublished: false }, admin);
    expect(ok.isPublished).toBe(false);
    await prisma.testimonial.deleteMany({});
  });

  it('template overrides are validated and used when sending', async () => {
    const admin = await actor('admin@demo.example');
    await expect(saveTemplate('booking.confirmed', { subject: 'Hi {{secret}}', body: 'x x x x x' }, admin)).rejects.toThrow(/Unknown placeholder/);
    await saveTemplate('contact.received', { subject: 'Thanks {{name}}!', body: 'Hello {{name}} from {{brandName}}.' }, admin);
    const n = await notify({ template: 'contact.received', recipient: 'x@test.example', data: { name: 'Asha', brandName: 'Studio' } });
    expect(n.subject).toBe('Thanks Asha!');
    expect(n.body).toBe('Hello Asha from Studio.');
    await prisma.notificationTemplate.deleteMany({});
  });

  it('saved services and notification preferences belong to the signed-in customer', async () => {
    const customer = await actor('customer@demo.example');
    await setSavedService(customer, I.portrait, true);
    await setSavedService(customer, I.portrait, true); // idempotent
    expect((await listSavedServices(customer)).map((s) => s.id)).toEqual([I.portrait]);
    await setSavedService(customer, I.portrait, false);
    expect(await listSavedServices(customer)).toEqual([]);
    await expect(setSavedService(customer, I.corporateEvents, true)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(updateNotificationPreferences(customer, { notifyEmail: true, notifyWhatsapp: true })).rejects.toThrow(/WhatsApp/);
    const p = await updateNotificationPreferences(customer, { notifyEmail: false, notifyWhatsapp: true, whatsappConsent: true });
    expect(p.whatsappConsentAt).not.toBeNull();
    const off = await updateNotificationPreferences(customer, { notifyEmail: true, notifyWhatsapp: false });
    expect(off.whatsappConsentAt).toBeNull();
  });

  it('upcoming-session reminders are sent once and respect opt-outs', async () => {
    const admin = await actor('admin@demo.example');
    const { booking } = await createBooking({ brand: 'PODCAST', serviceId: I.multicam, locationId: I.bom, date: futureWeekday(14), startTime: '10:00', contact: guest('remind@test.example'), acceptTerms: true }, null);
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED', holdExpiresAt: null } });
    const at = new Date(booking.startsAt.getTime() - 3 * 3_600_000);
    const first = await sendUpcomingReminders(24, at);
    expect(first.sent).toBe(1);
    const second = await sendUpcomingReminders(24, at);
    expect(second.considered).toBe(0);
    expect(await prisma.notification.count({ where: { bookingId: booking.id, template: 'booking.reminder' } })).toBe(1);
    void admin;
  });
});
