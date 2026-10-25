/* Resettable demo seed. Wipes ALL application data and re-creates the
 * demonstration dataset. Refuses to run in production, or when real
 * (non-demo) bookings exist, unless explicitly forced. */
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from '@studio/db';
import { PERMISSIONS, ROLE_DEFINITIONS } from '../permissions';
import { DEFAULT_SETTINGS, type SettingKey } from '../settings';
import { addDays, formatLocalDate, todayIn, localDayOfWeek, type LocalDate } from '../time';
import { createBooking, transitionBooking } from '../booking/service';
import { startPayment, simulateDemoPayment } from '../payments/service';
import { createEnquiry, saveQuotationDraft, sendQuotation } from '../enquiry/service';
import { loadActor } from '../actor';
import * as data from './data';
import imageCatalog from '../../../../assets/demo-images/catalog.json' with { type: 'json' };

export const DEMO_USERS = [
  { email: 'admin@demo.example', name: 'Demo Administrator', role: 'admin', password: 'DemoAdmin!2026' },
  { email: 'manager@demo.example', name: 'Demo Manager', role: 'manager', password: 'DemoManager!2026' },
  { email: 'staff@demo.example', name: 'Demo Staff', role: 'staff', password: 'DemoStaff!2026' },
  { email: 'customer@demo.example', name: 'Demo Customer', role: 'customer', password: 'DemoCustomer!2026' },
];

const TABLES = [
  'RescheduleRequest', 'EnquiryAttachment', 'SavedService', 'NotificationTemplate', 'ContentPage', 'Testimonial', 'HomeBanner',
  'ServiceEquipment', 'Equipment', 'ServiceDiscoveryCategory', 'DiscoveryCategory',
  'AuditLog', 'IntegrationCheck', 'Setting', 'ContactMessage', 'Faq', 'PortfolioImage', 'PortfolioProject',
  'Notification', 'WebhookEvent', 'Refund', 'Transaction', 'PaymentOrder', 'QuotationLine', 'Quotation',
  'EnquiryFollowUp', 'EnquiryService', 'BookingNote', 'BookingStatusHistory', 'BookingItem', 'Booking',
  'EventEnquiry', 'BlockedPeriod', 'OpeningHours', 'ServiceResource', 'ServiceLocation', 'ServiceAddOn',
  'Resource', 'Location', 'AddOn', 'Package', 'Service', 'Category', 'CustomerProfile',
  'verification', 'account', 'session', 'user', 'RolePermission', 'Permission', 'Role',
];

export async function seedDemo(opts: { force?: boolean; withSampleActivity?: boolean } = {}) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to seed demo data in production (set ALLOW_DEMO_SEED=true to override).');
  }
  const realBookings = await prisma.booking.count({ where: { isDemo: false } }).catch(() => 0);
  if (realBookings > 0 && !opts.force) {
    throw new Error(`Found ${realBookings} non-demo bookings. Refusing to wipe them. Re-run with --force if this database is disposable.`);
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

  // Roles and permissions
  await prisma.permission.createMany({ data: Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })) });
  for (const [key, def] of Object.entries(ROLE_DEFINITIONS)) {
    await prisma.role.create({ data: { key, name: def.name, description: def.description, isStaff: def.isStaff } });
    if (def.permissions.length) {
      await prisma.rolePermission.createMany({ data: def.permissions.map((permissionKey) => ({ roleKey: key, permissionKey })) });
    }
  }

  // Demo users (Better Auth credential accounts)
  const userIds: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const id = randomUUID();
    userIds[u.role] = id;
    await prisma.user.create({ data: { id, email: u.email, name: u.name, role: u.role, emailVerified: true } });
    await prisma.account.create({
      data: { id: randomUUID(), accountId: id, providerId: 'credential', userId: id, password: await hashPassword(u.password) },
    });
    if (u.role === 'customer') {
      await prisma.customerProfile.create({ data: { userId: id, fullName: u.name, email: u.email, phone: '+91 90000 00000', isDemo: true } });
    }
  }

  // Settings
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.create({ data: { key: key as SettingKey, value: value as object } });
  }

  // Catalogue
  const categoryIds: Record<string, string> = {};
  for (const [i, c] of data.categories.entries()) {
    const row = await prisma.category.create({ data: { ...c, sortOrder: i, isDemo: true } });
    categoryIds[`${c.brand}:${c.slug}`] = row.id;
  }
  const addOnIds: Record<string, string> = {};
  for (const a of data.addOns) {
    const row = await prisma.addOn.create({ data: { ...a, isDemo: true } });
    addOnIds[a.slug] = row.id;
  }
  const locationIds: Record<string, string> = {};
  for (const l of data.locations) {
    const { key, ...rest } = l;
    const row = await prisma.location.create({ data: { ...rest, country: 'IN', timezone: 'Asia/Kolkata', isDemo: true } });
    locationIds[key] = row.id;
    await prisma.openingHours.createMany({
      data: data.openingHours[key]!.map((h) => ({ locationId: row.id, dayOfWeek: h.dayOfWeek, openMinute: h.open, closeMinute: h.close, isDemo: true })),
    });
  }
  const resourceIds: Record<string, string> = {};
  for (const r of data.resources) {
    const row = await prisma.resource.create({
      data: { locationId: locationIds[r.location]!, name: r.name, type: r.type, description: r.description, capacity: r.capacity ?? null, isDemo: true },
    });
    resourceIds[r.key] = row.id;
  }
  const serviceIds: Record<string, string> = {};
  for (const [i, s] of data.services.entries()) {
    const row = await prisma.service.create({
      data: {
        brand: s.brand,
        categoryId: categoryIds[`${s.brand}:${s.category}`],
        slug: s.slug,
        name: s.name,
        summary: s.summary,
        description: s.description,
        bookingMode: s.bookingMode,
        pricingModel: s.pricingModel,
        basePriceMinor: s.basePriceMinor ?? 0,
        hourlyRateMinor: s.hourlyRateMinor ?? 0,
        minDurationMin: s.minDurationMin,
        maxDurationMin: s.maxDurationMin,
        durationStepMin: s.durationStepMin,
        defaultDurationMin: s.defaultDurationMin,
        bufferMin: s.bufferMin,
        requiresResource: s.requiresResource,
        imageKey: s.imageKey,
        sortOrder: i,
        isDemo: true,
        isFeatured: data.featuredServices.includes(s.key),
        preparation: data.servicePreparation[s.key] ?? null,
        galleryImageKeys: data.serviceGallery[s.key] ?? [],
        locations: { create: s.locations.map((k) => ({ locationId: locationIds[k]! })) },
        resources: { create: s.resources.map((k) => ({ resourceId: resourceIds[k]! })) },
        addOns: { create: s.addOns.map((k) => ({ addOnId: addOnIds[k]! })) },
        packages: { create: (s.packages ?? []).map((p, j) => ({ ...p, sortOrder: j, isDemo: true })) },
      },
    });
    serviceIds[s.key] = row.id;
  }

  // Studio discovery platform: categories, equipment, banners, policy pages
  const discoveryIds: Record<string, string> = {};
  for (const [i, c] of data.discoveryCategories.entries()) {
    discoveryIds[c.slug] = (await prisma.discoveryCategory.create({ data: { ...c, sortOrder: i, isDemo: true } })).id;
  }
  for (const [key, slugs] of Object.entries(data.serviceDiscovery)) {
    if (!serviceIds[key]) continue;
    await prisma.serviceDiscoveryCategory.createMany({ data: slugs.map((slug) => ({ serviceId: serviceIds[key]!, categoryId: discoveryIds[slug]! })) });
  }
  for (const [i, e] of data.equipment.entries()) {
    const row = await prisma.equipment.create({
      data: { name: e.name, category: e.category, imageKey: e.imageKey, description: 'Sample facility. Details and specifications to be confirmed by the studio.', isVerified: false, sortOrder: i },
    });
    const links = e.services.filter((k) => serviceIds[k]).map((k) => ({ serviceId: serviceIds[k]!, equipmentId: row.id }));
    if (links.length) await prisma.serviceEquipment.createMany({ data: links });
  }
  const catalogImages = imageCatalog.images as Record<string, { alt: string }>;
  for (const [i, b] of data.banners.entries()) {
    await prisma.homeBanner.create({ data: { ...b, imageAlt: catalogImages[b.imageKey]?.alt ?? b.title, sortOrder: i } });
  }
  for (const p of data.contentPages) await prisma.contentPage.create({ data: { ...p, isTemplate: true } });

  // Content
  const images = imageCatalog.images as Record<string, { alt: string }>;
  for (const [i, p] of data.portfolio.entries()) {
    await prisma.portfolioProject.create({
      data: {
        brand: p.brand,
        slug: p.slug,
        title: p.title,
        categoryId: categoryIds[`${p.brand}:${p.category}`],
        summary: p.summary,
        body: p.body,
        coverImage: p.cover,
        coverAlt: images[p.cover]?.alt ?? p.title,
        isSample: true,
        sortOrder: i,
        images: { create: p.images.map((key, j) => ({ imageKey: key, alt: images[key]?.alt ?? p.title, sortOrder: j })) },
      },
    });
  }
  for (const [brand, list] of Object.entries(data.faqs)) {
    await prisma.faq.createMany({ data: list.map((f, i) => ({ brand: brand as 'PHOTO', question: f.q, answer: f.a, sortOrder: i, isDemo: true })) });
  }

  // Sample blocked periods (relative to today so the demo always shows them)
  const today = todayIn('Asia/Kolkata');
  const dayAt = (d: LocalDate, hour: number) => new Date(`${formatLocalDate(d)}T${String(hour).padStart(2, '0')}:00:00+05:30`);
  await prisma.blockedPeriod.create({
    data: { resourceId: resourceIds['pod-room-1'], kind: 'MAINTENANCE', startsAt: dayAt(addDays(today, 6), 14), endsAt: dayAt(addDays(today, 6), 18), reason: 'Sample maintenance window (demo)' },
  });
  await prisma.blockedPeriod.create({
    data: { locationId: locationIds['blr-studio'], kind: 'CLOSURE', startsAt: dayAt(addDays(today, 20), 0), endsAt: dayAt(addDays(today, 21), 0), reason: 'Sample closure day (demo)' },
  });

  if (opts.withSampleActivity !== false) {
    await seedActivity({ today, serviceIds, locationIds, categoryIds, userIds });
  }

  return { users: DEMO_USERS.map(({ email, role, password }) => ({ email, role, password })) };
}

/** Next date (from +offset days) that falls on a weekday (Mon–Fri). */
function nextWeekday(today: LocalDate, offset: number): LocalDate {
  let d = addDays(today, offset);
  while ([0, 6].includes(localDayOfWeek(d, 'Asia/Kolkata'))) d = addDays(d, 1);
  return d;
}

async function seedActivity(ids: { today: LocalDate; serviceIds: Record<string, string>; locationIds: Record<string, string>; categoryIds: Record<string, string>; userIds: Record<string, string> }) {
  const { today, serviceIds, locationIds } = ids;
  const customer = await loadActor(ids.userIds.customer!);
  const admin = await loadActor(ids.userIds.admin!);
  if (!customer || !admin) throw new Error('Seed users missing');
  const portraitPkg = await prisma.package.findFirstOrThrow({ where: { serviceId: serviceIds.portrait, slug: 'signature' } });

  // 1. Confirmed via a simulated deposit payment (signed-in demo customer)
  const b1 = await createBooking({
    brand: 'PHOTO', serviceId: serviceIds.portrait!, packageId: portraitPkg.id, addOnIds: [], locationId: locationIds['blr-studio']!,
    date: formatLocalDate(nextWeekday(today, 4)), startTime: '10:00', contact: { name: 'Demo Customer', email: 'customer@demo.example', phone: '+91 90000 00000' },
    notes: 'Sample booking created by the demo seed.', acceptTerms: true,
  }, customer, {}, { isDemo: true });
  const pay = await startPayment(b1.booking.reference, { actor: customer }, 'DEPOSIT', 'seed-demo-deposit-1');
  await simulateDemoPayment(pay.order.id, 'success', { actor: customer });

  // 2. Awaiting payment (guest)
  await createBooking({
    brand: 'PODCAST', serviceId: serviceIds['audio-recording']!, addOnIds: [], locationId: locationIds['blr-studio']!,
    date: formatLocalDate(nextWeekday(today, 5)), startTime: '11:00', durationMin: 120,
    contact: { name: 'Sample Guest', email: 'guest@demo.example' }, acceptTerms: true,
  }, null, {}, { isDemo: true });

  // 3. Request awaiting review
  await createBooking({
    brand: 'PHOTO', serviceId: serviceIds['corporate-video']!, addOnIds: [], locationId: locationIds['blr-studio']!,
    date: formatLocalDate(nextWeekday(today, 9)), startTime: '09:00', durationMin: 480,
    contact: { name: 'Sample Company Contact', email: 'requests@demo.example' }, notes: 'Three interviews, two locations within the office (sample).', acceptTerms: true,
  }, null, {}, { isDemo: true });

  // 4. Confirmed podcast session then cancellation requested
  const b4 = await createBooking({
    brand: 'PODCAST', serviceId: serviceIds['video-podcast']!, addOnIds: [], locationId: locationIds['bom-studio']!,
    date: formatLocalDate(nextWeekday(today, 7)), startTime: '15:00', durationMin: 120,
    contact: { name: 'Demo Customer', email: 'customer@demo.example' }, acceptTerms: true,
  }, customer, {}, { isDemo: true });
  const pay4 = await startPayment(b4.booking.reference, { actor: customer }, 'FULL', 'seed-demo-full-4');
  await simulateDemoPayment(pay4.order.id, 'success', { actor: customer });
  await transitionBooking({ bookingId: b4.booking.id, to: 'CANCELLATION_REQUESTED', actorType: 'CUSTOMER', actor: customer, reason: 'Sample: host unavailable' });

  // 5. Cancelled by staff
  const b5 = await createBooking({
    brand: 'EVENTS', serviceId: serviceIds.consultation!, addOnIds: [], locationId: locationIds['events-lounge']!,
    date: formatLocalDate(nextWeekday(today, 3)), startTime: '11:00',
    contact: { name: 'Sample Planner', email: 'planner@demo.example' }, acceptTerms: true,
  }, null, {}, { isDemo: true });
  await transitionBooking({ bookingId: b5.booking.id, to: 'CANCELLED', actorType: 'STAFF', actor: admin, reason: 'Sample: customer asked to cancel by phone' });

  // Enquiries
  const corporate = await prisma.category.findFirstOrThrow({ where: { brand: 'EVENTS', slug: 'corporate' } });
  const e1 = await createEnquiry({
    categoryId: corporate.id, eventType: 'Annual offsite (sample)', preferredDate: formatLocalDate(addDays(today, 45)), expectedAttendance: 120,
    locationId: locationIds['garden-venue'], serviceIds: [serviceIds['corporate-events']!], budgetMinMinor: 50_000_000, budgetMaxMinor: 80_000_000,
    setupRequirements: 'Stage, AV for presentations, dinner seating (sample).', notes: 'Demonstration enquiry.',
    contact: { name: 'Sample HR Lead', email: 'offsite@demo.example', phone: '+91 90000 00001' }, acceptTerms: true,
  }, null);
  await prisma.eventEnquiry.update({ where: { id: e1.enquiry.id }, data: { isDemo: true } });
  const q = await saveQuotationDraft(e1.enquiry.id, {
    lines: [
      { description: 'Event planning and coordination (sample)', quantity: 1, unitPriceMinor: 15_000_000 },
      { description: 'Venue hire, garden lawn, full day (sample)', quantity: 1, unitPriceMinor: 20_000_000 },
      { description: 'Catering per guest (sample)', quantity: 120, unitPriceMinor: 180_000 },
    ],
    discountMinor: 0,
    customerMessage: 'Sample proposal generated by the demo seed.',
  }, admin);
  await sendQuotation(q.id, admin);

  const celebrations = await prisma.category.findFirstOrThrow({ where: { brand: 'EVENTS', slug: 'celebrations' } });
  const e2 = await createEnquiry({
    categoryId: celebrations.id, eventType: '40th birthday dinner (sample)', preferredDate: formatLocalDate(addDays(today, 30)), expectedAttendance: 40,
    serviceIds: [serviceIds.celebrations!], notes: 'Demonstration enquiry awaiting review.',
    contact: { name: 'Sample Host', email: 'host@demo.example' }, acceptTerms: true,
  }, null);
  await prisma.eventEnquiry.update({ where: { id: e2.enquiry.id }, data: { isDemo: true } });

  await prisma.contactMessage.create({
    data: { brand: 'PODCAST', name: 'Sample Visitor', email: 'visitor@demo.example', subject: 'Studio tour (sample)', message: 'Sample contact message created by the demo seed.' },
  });
  await prisma.customerProfile.updateMany({ data: { isDemo: true } });
}

/**
 * Adds the studio platform's demo content to a database created before it
 * existed. Purely additive: existing services, bookings, customers and content
 * are never changed or removed, so it is safe on a database with real bookings.
 */
export async function topUpStudioContent() {
  const added = { services: 0, categories: 0, equipment: 0, banners: 0, pages: 0, faqs: 0 };
  const serviceIds: Record<string, string> = {};
  for (const s of data.services) {
    const existing = await prisma.service.findUnique({ where: { brand_slug: { brand: s.brand, slug: s.slug } } });
    if (existing) {
      serviceIds[s.key] = existing.id;
      continue;
    }
    // Link only to records that exist; a missing location or resource is skipped rather than invented.
    const locs = await prisma.location.findMany({ where: { slug: { in: data.locations.filter((l) => s.locations.includes(l.key)).map((l) => l.slug) } } });
    const resourceDefs = data.resources.filter((r) => s.resources.includes(r.key));
    const resources = (
      await Promise.all(resourceDefs.map((r) => {
        const loc = locs.find((l) => l.slug === data.locations.find((d) => d.key === r.location)?.slug);
        return loc ? prisma.resource.findFirst({ where: { locationId: loc.id, name: r.name } }) : null;
      }))
    ).filter((r): r is NonNullable<typeof r> => !!r);
    const addOns = await prisma.addOn.findMany({ where: { brand: s.brand, slug: { in: s.addOns } } });
    const category = await prisma.category.findFirst({ where: { brand: s.brand, slug: s.category } });
    if (!locs.length) continue;
    const row = await prisma.service.create({
      data: {
        brand: s.brand, categoryId: category?.id ?? null, slug: s.slug, name: s.name, summary: s.summary, description: s.description,
        bookingMode: s.bookingMode, pricingModel: s.pricingModel, basePriceMinor: s.basePriceMinor ?? 0, hourlyRateMinor: s.hourlyRateMinor ?? 0,
        minDurationMin: s.minDurationMin, maxDurationMin: s.maxDurationMin, durationStepMin: s.durationStepMin, defaultDurationMin: s.defaultDurationMin,
        bufferMin: s.bufferMin, requiresResource: s.requiresResource, imageKey: s.imageKey, sortOrder: 100 + added.services, isDemo: true,
        isFeatured: data.featuredServices.includes(s.key), preparation: data.servicePreparation[s.key] ?? null, galleryImageKeys: data.serviceGallery[s.key] ?? [],
        locations: { create: locs.map((l) => ({ locationId: l.id })) },
        resources: { create: resources.map((r) => ({ resourceId: r.id })) },
        addOns: { create: addOns.map((a) => ({ addOnId: a.id })) },
        packages: { create: (s.packages ?? []).map((p, j) => ({ ...p, sortOrder: j, isDemo: true })) },
      },
    });
    serviceIds[s.key] = row.id;
    added.services += 1;
  }

  const discoveryIds: Record<string, string> = {};
  for (const [i, c] of data.discoveryCategories.entries()) {
    const existing = await prisma.discoveryCategory.findUnique({ where: { slug: c.slug } });
    discoveryIds[c.slug] = existing?.id ?? (await prisma.discoveryCategory.create({ data: { ...c, sortOrder: i, isDemo: true } })).id;
    if (!existing) added.categories += 1;
  }
  for (const [key, slugs] of Object.entries(data.serviceDiscovery)) {
    if (!serviceIds[key]) continue;
    await prisma.serviceDiscoveryCategory.createMany({ data: slugs.map((slug) => ({ serviceId: serviceIds[key]!, categoryId: discoveryIds[slug]! })), skipDuplicates: true });
  }
  if ((await prisma.equipment.count()) === 0) {
    for (const [i, e] of data.equipment.entries()) {
      const row = await prisma.equipment.create({
        data: { name: e.name, category: e.category, imageKey: e.imageKey, description: 'Sample facility. Details and specifications to be confirmed by the studio.', isVerified: false, sortOrder: i },
      });
      const links = e.services.filter((k) => serviceIds[k]).map((k) => ({ serviceId: serviceIds[k]!, equipmentId: row.id }));
      if (links.length) await prisma.serviceEquipment.createMany({ data: links, skipDuplicates: true });
      added.equipment += 1;
    }
  }
  if ((await prisma.homeBanner.count()) === 0) {
    const catalogImages = imageCatalog.images as Record<string, { alt: string }>;
    for (const [i, b] of data.banners.entries()) {
      await prisma.homeBanner.create({ data: { ...b, imageAlt: catalogImages[b.imageKey]?.alt ?? b.title, sortOrder: i } });
      added.banners += 1;
    }
  }
  for (const p of data.contentPages) {
    if (await prisma.contentPage.findUnique({ where: { slug: p.slug } })) continue;
    await prisma.contentPage.create({ data: { ...p, isTemplate: true } });
    added.pages += 1;
  }
  if ((await prisma.faq.count({ where: { brand: 'STUDIO' } })) === 0) {
    const list = data.faqs.STUDIO ?? [];
    await prisma.faq.createMany({ data: list.map((f, i) => ({ brand: 'STUDIO' as const, question: f.q, answer: f.a, sortOrder: i, isDemo: true })) });
    added.faqs = list.length;
  }
  return added;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!);
if (isMain) {
  const ifEmpty = process.argv.includes('--if-empty');
  (ifEmpty
    ? Promise.all([prisma.user.count(), prisma.discoveryCategory.count(), prisma.booking.count({ where: { isDemo: false } })]).then(([users, studio, real]) => {
        const skip = { users: [] as { email: string; role: string; password: string }[] };
        if (users === 0) return seedDemo({ force: process.argv.includes('--force') });
        if (studio > 0) {
          console.info('Database already has data: skipping demo seed (--if-empty).');
          return skip;
        }
        // A database created before the studio platform existed: add its content without touching existing data.
        return topUpStudioContent().then((added) => {
          console.info(`Added studio platform content (existing data kept): ${JSON.stringify(added)}`);
          return skip;
        });
      })
    : seedDemo({ force: process.argv.includes('--force') }))
    .then((r) => {
      if (!r.users.length) return;
      console.info('Demo data seeded. Demo accounts (demonstration only):');
      for (const u of r.users) console.info(`  ${u.role.padEnd(9)} ${u.email}  ${u.password}`);
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
