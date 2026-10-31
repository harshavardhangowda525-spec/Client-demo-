import { prisma, type Db, type Prisma } from '@studio/db';
import { notFound } from '../errors';
import { getAllSettings, getSetting, STUDIO_BRANDS } from '../settings';
import { getAvailability } from '../availability/service';
import { addDays, formatLocalDate, minutesToHHMM, parseLocalDate, todayIn } from '../time';
import { publicIntegrationFlags } from '../integrations/status';
import { ratingSummaries } from '../reviews/service';
import { listPublicOffers } from '../offers/service';
import type { studioListingQuerySchema } from '../schemas';
import type { z } from 'zod';

type ListingQuery = z.infer<typeof studioListingQuerySchema>;

const serviceInclude = {
  category: { select: { slug: true, name: true } },
  packages: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
  addOns: { where: { addOn: { isActive: true } }, include: { addOn: true } },
  locations: { where: { location: { isActive: true } }, include: { location: true } },
  discoveryCategories: { where: { category: { isActive: true } }, include: { category: true } },
  equipment: { where: { equipment: { isActive: true } }, include: { equipment: true } },
} satisfies Prisma.ServiceInclude;

type ServiceRow = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

const studioWhere = (extra: Prisma.ServiceWhereInput = {}): Prisma.ServiceWhereInput => ({ brand: { in: [...STUDIO_BRANDS] }, isActive: true, ...extra });

function loadServices(where: Prisma.ServiceWhereInput, db: Db) {
  return db.service.findMany({ where, include: serviceInclude, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}

/** Lowest price a customer can pay for the service (null = by quotation). */
export function fromPriceMinor(s: Pick<ServiceRow, 'bookingMode' | 'pricingModel' | 'basePriceMinor' | 'hourlyRateMinor' | 'minDurationMin' | 'packages'>): number | null {
  if (s.bookingMode === 'ENQUIRY' || s.pricingModel === 'QUOTE') return null;
  if (s.pricingModel === 'HOURLY') return Math.round((s.hourlyRateMinor * s.minDurationMin) / 60);
  const prices = [s.basePriceMinor, ...s.packages.map((p) => p.priceMinor)].filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

function cardDto(s: ServiceRow, popularity = 0) {
  return {
    id: s.id,
    slug: s.slug,
    brand: s.brand,
    name: s.name,
    summary: s.summary,
    imageKey: s.imageKey,
    bookingMode: s.bookingMode,
    pricingModel: s.pricingModel,
    fromPriceMinor: fromPriceMinor(s),
    hourlyRateMinor: s.hourlyRateMinor,
    minDurationMin: s.minDurationMin,
    maxDurationMin: s.maxDurationMin,
    packagesCount: s.packages.length,
    categories: s.discoveryCategories.map((c) => ({ slug: c.category.slug, name: c.category.name })),
    cities: [...new Set(s.locations.map((l) => l.location.city))],
    isFeatured: s.isFeatured,
    isDemo: s.isDemo,
    popularity,
  };
}
export type StudioServiceCard = ReturnType<typeof cardDto> & {
  nextAvailable?: { date: string; startTime: string; city: string } | null;
  /** Published customer reviews only; null when there are none. */
  rating?: { average: number; count: number } | null;
};

/** Adds the real average rating (or null) to each card. */
async function withRatings<T extends { id: string }>(cards: T[], db: Db): Promise<(T & { rating: { average: number; count: number } | null })[]> {
  const map = await ratingSummaries(cards.map((c) => c.id), db);
  return cards.map((c) => ({ ...c, rating: map.get(c.id) ?? null }));
}

async function popularityMap(db: Db) {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const rows = await db.booking.groupBy({ by: ['serviceId'], where: { createdAt: { gte: since }, status: { notIn: ['CANCELLED', 'REJECTED'] } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.serviceId, r._count._all]));
}

// --- Next available slot (real availability, cached briefly) -------------------
const nextCache = new Map<string, { at: number; value: StudioServiceCard['nextAvailable'] }>();

export async function nextAvailableSlot(s: ServiceRow, city?: string, db: Db = prisma): Promise<StudioServiceCard['nextAvailable']> {
  if (s.bookingMode === 'ENQUIRY') return null;
  const key = `${s.id}:${city ?? ''}`;
  const hit = nextCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const tz = s.locations[0]?.location.timezone ?? 'Asia/Kolkata';
  const today = formatLocalDate(todayIn(tz));
  const pkg = s.packages.find((p) => p.isFeatured) ?? s.packages[0];
  let best: NonNullable<StudioServiceCard['nextAvailable']> | null = null;
  for (const link of s.locations) {
    if (city && link.location.city.toLowerCase() !== city.toLowerCase()) continue;
    try {
      const a = await getAvailability({ serviceId: s.id, locationId: link.locationId, date: today, days: 14, packageId: pkg?.id ?? null, durationMin: pkg ? null : s.minDurationMin }, db);
      const day = a.days.find((d) => d.slots.length);
      if (day && (!best || day.date < best.date || (day.date === best.date && day.slots[0]!.startTime < best.startTime))) {
        best = { date: day.date, startTime: day.slots[0]!.startTime, city: link.location.city };
      }
    } catch {
      /* misconfigured service/location: no indicator rather than a fake one */
    }
  }
  nextCache.set(key, { at: Date.now(), value: best });
  return best;
}

async function withAvailability(rows: ServiceRow[], pop: Map<string, number>, city: string | undefined, db: Db): Promise<StudioServiceCard[]> {
  return Promise.all(rows.map(async (s) => ({ ...cardDto(s, pop.get(s.id) ?? 0), nextAvailable: await nextAvailableSlot(s, city, db) })));
}

// --- Home ---------------------------------------------------------------------
export async function getStudioHome(city?: string, db: Db = prisma) {
  const now = new Date();
  const [settings, banners, categories, services, equipment, portfolio, testimonials, faqs, pop] = await Promise.all([
    getAllSettings(db),
    db.homeBanner.findMany({ where: { isActive: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] }, orderBy: { sortOrder: 'asc' } }),
    db.discoveryCategory.findMany({ where: { isActive: true }, include: { _count: { select: { services: { where: { service: studioWhere() } } } } }, orderBy: { sortOrder: 'asc' } }),
    loadServices(studioWhere(city ? { locations: { some: { location: { city: { equals: city, mode: 'insensitive' } } } } } : {}), db),
    db.equipment.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    db.portfolioProject.findMany({ where: { brand: { in: [...STUDIO_BRANDS] }, isPublished: true }, include: { category: { select: { slug: true, name: true } } }, orderBy: { sortOrder: 'asc' }, take: 8 }),
    db.testimonial.findMany({ where: { isPublished: true, isAuthorized: true }, orderBy: { sortOrder: 'asc' }, take: 6 }),
    db.faq.findMany({ where: { brand: 'STUDIO', isActive: true }, orderBy: { sortOrder: 'asc' } }),
    popularityMap(db),
  ]);
  const popular = [...services].sort((a, b) => (pop.get(b.id) ?? 0) - (pop.get(a.id) ?? 0) || a.sortOrder - b.sortOrder).slice(0, 10);
  const featured = services.filter((s) => s.isFeatured).slice(0, 6);
  const packages = services
    .flatMap((s) => s.packages.map((p) => ({ ...p, service: { slug: s.slug, name: s.name, imageKey: s.imageKey, addOns: s.addOns.map((a) => a.addOn.name) } })))
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.priceMinor - b.priceMinor)
    .slice(0, 8);
  const cities = [...new Set((await db.location.findMany({ where: { isActive: true, brands: { hasSome: [...STUDIO_BRANDS] } }, select: { city: true } })).map((l) => l.city))].sort();
  return {
    site: settings.siteContent.STUDIO,
    pricing: { taxLabel: settings.pricing.taxLabel, isSample: settings.pricing.isSample },
    highlights: settings.studioHighlights,
    integrations: publicIntegrationFlags(),
    cities,
    banners: banners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, imageKey: b.imageKey, imageAlt: b.imageAlt, ctaLabel: b.ctaLabel, ctaHref: b.ctaHref, offerText: b.offerText })),
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description, imageKey: c.imageKey, serviceCount: c._count.services, isDemo: c.isDemo })),
    popular: await withRatings(await withAvailability(popular, pop, city, db), db),
    featured: await withRatings(featured.map((s) => cardDto(s, pop.get(s.id) ?? 0)), db),
    offers: (await listPublicOffers(db, now)).slice(0, 6),
    packages: packages.map((p) => ({ id: p.id, name: p.name, description: p.description, includes: p.includes, priceMinor: p.priceMinor, durationMin: p.durationMin, isFeatured: p.isFeatured, isDemo: p.isDemo, service: p.service })),
    equipment: equipment.map((e) => ({ id: e.id, name: e.name, category: e.category, description: e.description, imageKey: e.imageKey, isVerified: e.isVerified })),
    portfolio: portfolio.map((p) => ({ id: p.id, slug: p.slug, title: p.title, summary: p.summary, coverImage: p.coverImage, coverAlt: p.coverAlt, videoUrl: p.videoUrl, category: p.category, isSample: p.isSample })),
    testimonials: testimonials.map((t) => ({ id: t.id, quote: t.quote, authorName: t.authorName, authorDetail: t.authorDetail })),
    faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, isDemo: f.isDemo })),
  };
}

// --- Search -------------------------------------------------------------------
function textFilter(q: string): Prisma.ServiceWhereInput {
  const contains = { contains: q, mode: 'insensitive' as const };
  return {
    OR: [
      { name: contains },
      { summary: contains },
      { description: contains },
      { packages: { some: { isActive: true, name: contains } } },
      { discoveryCategories: { some: { category: { name: contains } } } },
      { equipment: { some: { equipment: { name: contains } } } },
      { category: { name: contains } },
    ],
  };
}

/** Search across services, packages, categories and equipment. Returns real records only. */
export async function searchStudio(q: string, db: Db = prisma) {
  const term = q.trim().slice(0, 100);
  if (term.length < 2) return { query: term, services: [], categories: [] };
  // Multi-word queries match services containing every word ("podcast recording").
  const words = term.split(/\s+/).filter((w) => w.length >= 2).slice(0, 5);
  const [rows, cats, pop] = await Promise.all([
    loadServices(studioWhere({ AND: words.map(textFilter) }), db),
    db.discoveryCategory.findMany({ where: { isActive: true, OR: words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })) }, take: 5 }),
    popularityMap(db),
  ]);
  const lower = term.toLowerCase();
  const score = (s: ServiceRow) => (s.name.toLowerCase().includes(lower) ? 3 : 0) + (s.discoveryCategories.some((c) => c.category.name.toLowerCase().includes(lower)) ? 2 : 0) + (pop.get(s.id) ?? 0) / 1000;
  return {
    query: term,
    services: await withRatings(rows.sort((a, b) => score(b) - score(a)).slice(0, 20).map((s) => cardDto(s, pop.get(s.id) ?? 0)), db),
    categories: cats.map((c) => ({ slug: c.slug, name: c.name })),
  };
}

// --- Listing with filters -------------------------------------------------------
export async function listStudioServices(q: ListingQuery, db: Db = prisma) {
  const and: Prisma.ServiceWhereInput[] = [];
  if (q.category && q.category !== 'all') and.push({ discoveryCategories: { some: { category: { slug: q.category } } } });
  if (q.q) and.push(...q.q.split(/\s+/).filter((w) => w.length >= 2).slice(0, 5).map(textFilter));
  if (q.city) and.push({ locations: { some: { location: { city: { equals: q.city, mode: 'insensitive' }, isActive: true } } } });
  if (q.equipment) and.push({ equipment: { some: { equipmentId: q.equipment } } });
  if (q.maxDuration) and.push({ minDurationMin: { lte: q.maxDuration } });
  if (q.type === 'package') and.push({ packages: { some: { isActive: true } } });
  if (q.type === 'hourly') and.push({ pricingModel: 'HOURLY', bookingMode: { not: 'ENQUIRY' } });
  if (q.type === 'fixed') and.push({ pricingModel: 'FIXED', bookingMode: { not: 'ENQUIRY' } });
  if (q.type === 'quote') and.push({ bookingMode: 'ENQUIRY' });

  const [rows, pop, category] = await Promise.all([
    loadServices(studioWhere(and.length ? { AND: and } : {}), db),
    popularityMap(db),
    q.category && q.category !== 'all' ? db.discoveryCategory.findUnique({ where: { slug: q.category } }) : Promise.resolve(null),
  ]);
  if (q.category && q.category !== 'all' && !category) throw notFound('Category');

  let items = rows;
  if (q.minPrice != null || q.maxPrice != null) {
    items = items.filter((s) => {
      const p = fromPriceMinor(s);
      return p != null && (q.minPrice == null || p >= q.minPrice) && (q.maxPrice == null || p <= q.maxPrice);
    });
  }
  if (q.date) {
    const date = q.date;
    const checks = await Promise.all(
      items.map(async (s) => {
        if (s.bookingMode === 'ENQUIRY') return false;
        const pkg = s.packages.find((p) => p.isFeatured) ?? s.packages[0];
        for (const link of s.locations) {
          if (q.city && link.location.city.toLowerCase() !== q.city.toLowerCase()) continue;
          try {
            const a = await getAvailability({ serviceId: s.id, locationId: link.locationId, date, days: 1, packageId: pkg?.id ?? null, durationMin: pkg ? null : s.minDurationMin }, db);
            if (a.days[0]?.slots.length) return true;
          } catch {
            /* ignore */
          }
        }
        return false;
      }),
    );
    items = items.filter((_, i) => checks[i]);
  }

  const price = (s: ServiceRow) => fromPriceMinor(s) ?? Number.MAX_SAFE_INTEGER;
  const sorters: Record<ListingQuery['sort'], (a: ServiceRow, b: ServiceRow) => number> = {
    popular: (a, b) => (pop.get(b.id) ?? 0) - (pop.get(a.id) ?? 0) || Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder,
    price_asc: (a, b) => price(a) - price(b),
    price_desc: (a, b) => (fromPriceMinor(b) ?? -1) - (fromPriceMinor(a) ?? -1),
    duration: (a, b) => a.minDurationMin - b.minDurationMin,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  items = [...items].sort(sorters[q.sort]);
  const total = items.length;
  const pageItems = items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);

  // Facets describe the whole studio catalogue so filters never offer options with no data behind them.
  const all = await loadServices(studioWhere(), db);
  const prices = all.map(fromPriceMinor).filter((p): p is number => p != null);
  const equipmentFacet = new Map<string, string>();
  for (const s of all) for (const e of s.equipment) equipmentFacet.set(e.equipment.id, e.equipment.name);

  return {
    category: category ? { slug: category.slug, name: category.name, description: category.description, imageKey: category.imageKey, isDemo: category.isDemo } : null,
    total,
    page: q.page,
    pageSize: q.pageSize,
    items: await withRatings(await withAvailability(pageItems, pop, q.city, db), db),
    facets: {
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,
      cities: [...new Set(all.flatMap((s) => s.locations.map((l) => l.location.city)))].sort(),
      equipment: [...equipmentFacet].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      types: [
        ...(all.some((s) => s.packages.length) ? ['package'] : []),
        ...(all.some((s) => s.pricingModel === 'HOURLY' && s.bookingMode !== 'ENQUIRY') ? ['hourly'] : []),
        ...(all.some((s) => s.pricingModel === 'FIXED' && s.bookingMode !== 'ENQUIRY') ? ['fixed'] : []),
        ...(all.some((s) => s.bookingMode === 'ENQUIRY') ? ['quote'] : []),
      ],
      durations: [...new Set(all.map((s) => s.minDurationMin))].sort((a, b) => a - b),
    },
  };
}

export async function getStudioCategories(db: Db = prisma) {
  const rows = await db.discoveryCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  return rows.map((c) => ({ slug: c.slug, name: c.name, description: c.description, imageKey: c.imageKey }));
}

// --- Detail ------------------------------------------------------------------------
export async function getStudioService(slug: string, db: Db = prisma) {
  const [s] = await loadServices(studioWhere({ slug }), db);
  if (!s) throw notFound('Service');
  const settings = await getAllSettings(db);
  const pop = await popularityMap(db);
  const [portfolio, related, testimonials, hours, nextAvailable] = await Promise.all([
    db.portfolioProject.findMany({
      where: { brand: s.brand, isPublished: true, ...(s.categoryId ? { categoryId: s.categoryId } : {}) },
      orderBy: { sortOrder: 'asc' },
      take: 4,
    }),
    loadServices(studioWhere({ id: { not: s.id }, discoveryCategories: { some: { categoryId: { in: s.discoveryCategories.map((c) => c.categoryId) } } } }), db),
    db.testimonial.findMany({ where: { serviceId: s.id, isPublished: true, isAuthorized: true } }),
    db.openingHours.findMany({ where: { locationId: { in: s.locations.map((l) => l.locationId) }, resourceId: null }, orderBy: [{ dayOfWeek: 'asc' }, { openMinute: 'asc' }] }),
    nextAvailableSlot(s, undefined, db),
  ]);
  return {
    ...cardDto(s, pop.get(s.id) ?? 0),
    description: s.description,
    preparation: s.preparation,
    galleryImageKeys: [s.imageKey, ...s.galleryImageKeys].filter((k): k is string => !!k),
    durationStepMin: s.durationStepMin,
    defaultDurationMin: s.defaultDurationMin,
    basePriceMinor: s.basePriceMinor,
    depositBps: s.depositBpsOverride ?? settings.pricing.depositBps,
    category: s.category,
    packages: s.packages.map((p) => ({ id: p.id, slug: p.slug, name: p.name, description: p.description, includes: p.includes, priceMinor: p.priceMinor, durationMin: p.durationMin, isFeatured: p.isFeatured, isDemo: p.isDemo })),
    addOns: s.addOns.map(({ addOn: a }) => ({ id: a.id, name: a.name, description: a.description, pricing: a.pricing, priceMinor: a.priceMinor, isDemo: a.isDemo })),
    equipment: s.equipment.map(({ equipment: e }) => ({ id: e.id, name: e.name, category: e.category, description: e.description, isVerified: e.isVerified })),
    locations: s.locations.map(({ location: l }) => ({
      id: l.id,
      name: l.name,
      addressLine1: l.addressLine1,
      city: l.city,
      timezone: l.timezone,
      isDemo: l.isDemo,
      description: l.description,
      openingHours: hours.filter((h) => h.locationId === l.id).map((h) => ({ dayOfWeek: h.dayOfWeek, open: minutesToHHMM(h.openMinute), close: minutesToHHMM(h.closeMinute) })),
    })),
    locationIds: s.locations.map((l) => l.locationId),
    cancellationPolicy: settings.cancellationPolicy,
    pricing: { taxLabel: settings.pricing.taxLabel, isSample: settings.pricing.isSample },
    portfolio: portfolio.map((p) => ({ id: p.id, slug: p.slug, title: p.title, coverImage: p.coverImage, coverAlt: p.coverAlt, isSample: p.isSample })),
    related: await withRatings(related.slice(0, 8).map((r) => cardDto(r, pop.get(r.id) ?? 0)), db),
    rating: (await ratingSummaries([s.id], db)).get(s.id) ?? null,
    testimonials: testimonials.map((t) => ({ id: t.id, quote: t.quote, authorName: t.authorName, authorDetail: t.authorDetail })),
    nextAvailable,
  };
}

/** Studio portfolio with category filters and video support. */
export async function getStudioPortfolio(category: string | undefined, db: Db = prisma) {
  const rows = await db.portfolioProject.findMany({
    where: { brand: { in: [...STUDIO_BRANDS] }, isPublished: true, ...(category ? { category: { slug: category } } : {}) },
    include: { category: { select: { slug: true, name: true } }, images: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  const cats = await db.category.findMany({ where: { brand: { in: [...STUDIO_BRANDS] }, portfolio: { some: { isPublished: true } } }, select: { slug: true, name: true } });
  return {
    categories: [...new Map(cats.map((c) => [c.slug, c])).values()],
    items: rows.map((p) => ({
      id: p.id, slug: p.slug, title: p.title, summary: p.summary, body: p.body, coverImage: p.coverImage, coverAlt: p.coverAlt, videoUrl: p.videoUrl, clientCredit: p.clientCredit, category: p.category, isSample: p.isSample,
      images: p.images.map((i) => ({ id: i.id, imageKey: i.imageKey, alt: i.alt, caption: i.caption })),
    })),
  };
}

export async function getContentPage(slug: string, db: Db = prisma) {
  const page = await db.contentPage.findUnique({ where: { slug } });
  if (!page) throw notFound('Page');
  return page;
}

export async function studioCities(db: Db = prisma) {
  const settings = await getSetting('regional', db);
  const rows = await db.location.findMany({ where: { isActive: true, brands: { hasSome: [...STUDIO_BRANDS] } }, select: { city: true } });
  return { timezone: settings.timezone, cities: [...new Set(rows.map((r) => r.city))].sort() };
}



// --- Showtimes-style slot picker ---------------------------------------------------------
/**
 * Free start times for one date at every studio offering the service, plus
 * which of the next days have any free time (for the date strip). Uses the
 * same availability engine as booking, so a shown time can actually be booked.
 */
export async function getShowtimes(
  slug: string,
  q: { date?: string; packageId?: string | null; durationMin?: number | null; city?: string; days?: number },
  db: Db = prisma,
) {
  const [s] = await loadServices(studioWhere({ slug }), db);
  if (!s) throw notFound('Service');
  if (s.bookingMode === 'ENQUIRY') return { serviceId: s.id, bookingMode: s.bookingMode, days: [], date: null, locations: [] };
  const pkg = q.packageId ? s.packages.find((p) => p.id === q.packageId) : (s.packages.find((p) => p.isFeatured) ?? s.packages[0]);
  if (q.packageId && !pkg) throw notFound('Package');
  const durationMin = pkg ? null : (q.durationMin ?? s.defaultDurationMin);
  const links = s.locations.filter((l) => !q.city || l.location.city.toLowerCase() === q.city.toLowerCase());
  const tz = links[0]?.location.timezone ?? 'Asia/Kolkata';
  const todayLocal = todayIn(tz);
  const today = formatLocalDate(todayLocal);
  const span = Math.min(Math.max(q.days ?? 14, 1), 31);
  // A requested date beyond the first strip (e.g. a shared link) moves the strip
  // to start just before it, instead of silently showing a different date.
  let start = today;
  if (q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) && q.date > formatLocalDate(addDays(todayLocal, span - 1))) {
    const requested = parseLocalDate(q.date);
    if (requested) {
      const from = formatLocalDate(addDays(requested, -3));
      start = from > today ? from : today;
    }
  }
  const results = await Promise.all(
    links.map(async (l) => {
      try {
        const a = await getAvailability({ serviceId: s.id, locationId: l.locationId, date: start, days: span, packageId: pkg?.id ?? null, durationMin }, db);
        return { location: l.location, availability: a };
      } catch {
        return { location: l.location, availability: null };
      }
    }),
  );
  const dayMap = new Map<string, number>();
  for (const r of results) for (const d of r.availability?.days ?? []) dayMap.set(d.date, (dayMap.get(d.date) ?? 0) + d.slots.length);
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, slots]) => ({ date, slots }));
  const date = q.date && dayMap.has(q.date) ? q.date : (days.find((d) => d.slots > 0)?.date ?? days[0]?.date ?? today);
  return {
    serviceId: s.id,
    bookingMode: s.bookingMode,
    packageId: pkg?.id ?? null,
    durationMin: pkg?.durationMin ?? durationMin,
    isDemoAvailability: results.some((r) => r.availability?.isDemoAvailability),
    days,
    date,
    locations: results.map((r) => ({
      id: r.location.id,
      name: r.location.name,
      addressLine1: r.location.addressLine1,
      city: r.location.city,
      isDemo: r.location.isDemo,
      slots: (r.availability?.days.find((d) => d.date === date)?.slots ?? []).map((sl) => ({ startTime: sl.startTime, endTime: sl.endTime })),
    })),
  };
}
