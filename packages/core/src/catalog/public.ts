import { prisma, type Brand, type Db } from '@studio/db';
import { notFound } from '../errors';
import { getAllSettings } from '../settings';
import { publicIntegrationFlags } from '../integrations/status';
import { minutesToHHMM } from '../time';

export async function getSiteConfig(brand: Brand, db: Db = prisma) {
  const s = await getAllSettings(db);
  return {
    brand,
    site: s.siteContent[brand],
    business: { name: s.business.name, isDemo: s.business.isDemo },
    regional: s.regional,
    bookingRules: {
      leadTimeHours: s.bookingRules.leadTimeHours,
      maxAdvanceDays: s.bookingRules.maxAdvanceDays,
      holdMinutes: s.bookingRules.holdMinutes,
      allowGuestBookings: s.bookingRules.allowGuestBookings,
      isDemoAvailability: s.bookingRules.isDemoAvailability,
    },
    pricing: { taxLabel: s.pricing.taxLabel, taxRateBps: s.pricing.taxRateBps, depositBps: s.pricing.depositBps, isSample: s.pricing.isSample },
    cancellationPolicy: s.cancellationPolicy,
    integrations: publicIntegrationFlags(),
  };
}

const serviceInclude = {
  category: { select: { id: true, slug: true, name: true } },
  packages: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
  addOns: { where: { addOn: { isActive: true } }, include: { addOn: true } },
  locations: { where: { location: { isActive: true } }, select: { locationId: true } },
};

type ServiceWithRelations = Awaited<ReturnType<typeof loadServices>>[number];

function loadServices(where: object, db: Db) {
  return db.service.findMany({ where, include: serviceInclude, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}

function serviceDto(s: ServiceWithRelations) {
  return {
    id: s.id,
    slug: s.slug,
    brand: s.brand,
    name: s.name,
    summary: s.summary,
    description: s.description,
    category: s.category,
    bookingMode: s.bookingMode,
    pricingModel: s.pricingModel,
    basePriceMinor: s.basePriceMinor,
    hourlyRateMinor: s.hourlyRateMinor,
    minDurationMin: s.minDurationMin,
    maxDurationMin: s.maxDurationMin,
    durationStepMin: s.durationStepMin,
    defaultDurationMin: s.defaultDurationMin,
    imageKey: s.imageKey,
    isDemo: s.isDemo,
    packages: s.packages.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, includes: p.includes, priceMinor: p.priceMinor, durationMin: p.durationMin, isFeatured: p.isFeatured, isDemo: p.isDemo })),
    addOns: s.addOns.map(({ addOn: a }) => ({ id: a.id, name: a.name, description: a.description, pricing: a.pricing, priceMinor: a.priceMinor, isDemo: a.isDemo })),
    locationIds: s.locations.map((l) => l.locationId),
  };
}

export type PublicService = ReturnType<typeof serviceDto>;

export async function getCatalog(brand: Brand, db: Db = prisma) {
  const [categories, services] = await Promise.all([
    db.category.findMany({ where: { brand, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    loadServices({ brand, isActive: true }, db),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, isDemo: c.isDemo })),
    services: services.map(serviceDto),
  };
}

export async function getServiceBySlug(brand: Brand, slug: string, db: Db = prisma) {
  const [s] = await loadServices({ brand, slug, isActive: true }, db);
  if (!s) throw notFound('Service');
  return serviceDto(s);
}

export async function getLocations(brand: Brand, db: Db = prisma) {
  const rows = await db.location.findMany({
    where: { isActive: true, brands: { has: brand } },
    include: {
      openingHours: { where: { resourceId: null }, orderBy: [{ dayOfWeek: 'asc' }, { openMinute: 'asc' }] },
      resources: { where: { isActive: true, services: { some: { service: { brand } } } }, orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });
  return rows.map((l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    addressLine1: l.addressLine1,
    addressLine2: l.addressLine2,
    city: l.city,
    region: l.region,
    postalCode: l.postalCode,
    country: l.country,
    timezone: l.timezone,
    phone: l.phone,
    email: l.email,
    description: l.description,
    imageKey: l.imageKey,
    latitude: l.latitude,
    longitude: l.longitude,
    isDemo: l.isDemo,
    openingHours: l.openingHours.map((h) => ({ dayOfWeek: h.dayOfWeek, open: minutesToHHMM(h.openMinute), close: minutesToHHMM(h.closeMinute), isDemo: h.isDemo })),
    resources: l.resources.map((r) => ({ id: r.id, name: r.name, type: r.type, description: r.description, capacity: r.capacity, isDemo: r.isDemo })),
  }));
}

export async function getPortfolio(brand: Brand, categorySlug: string | undefined, db: Db = prisma) {
  const rows = await db.portfolioProject.findMany({
    where: { brand, isPublished: true, ...(categorySlug ? { category: { slug: categorySlug } } : {}) },
    include: { category: { select: { slug: true, name: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map((p) => ({ id: p.id, slug: p.slug, title: p.title, summary: p.summary, coverImage: p.coverImage, coverAlt: p.coverAlt, category: p.category, isSample: p.isSample }));
}

export async function getPortfolioProject(brand: Brand, slug: string, db: Db = prisma) {
  const p = await db.portfolioProject.findUnique({
    where: { brand_slug: { brand, slug } },
    include: { category: { select: { slug: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!p || !p.isPublished) throw notFound('Project');
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    body: p.body,
    coverImage: p.coverImage,
    coverAlt: p.coverAlt,
    category: p.category,
    isSample: p.isSample,
    images: p.images.map((i) => ({ id: i.id, imageKey: i.imageKey, alt: i.alt, caption: i.caption })),
  };
}

export async function getFaqs(brand: Brand, db: Db = prisma) {
  const rows = await db.faq.findMany({ where: { brand, isActive: true }, orderBy: { sortOrder: 'asc' } });
  return rows.map((f) => ({ id: f.id, question: f.question, answer: f.answer, isDemo: f.isDemo }));
}
