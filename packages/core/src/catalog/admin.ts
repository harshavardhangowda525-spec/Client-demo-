import { z } from 'zod';
import { prisma, type Db } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, invalid, notFound } from '../errors';
import { ACTIVE_BOOKING_STATUSES } from '../booking/status';
import { brandSchema } from '../schemas';
import { hhmmToMinutes, isValidTimeZone } from '../time';

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens').max(80);
const text = (max: number) => z.string().trim().max(max);
const money = z.coerce.number().int().min(0).max(1_000_000_000);
const optionalId = z.string().min(1).max(64).optional().nullable();

export const serviceInputSchema = z
  .object({
    isDemo: z.boolean().optional(),
    brand: brandSchema,
    categoryId: optionalId,
    slug,
    name: text(120).min(2),
    summary: text(300).min(2),
    description: text(5000).min(2),
    bookingMode: z.enum(['DIRECT', 'REQUEST', 'ENQUIRY']),
    pricingModel: z.enum(['FIXED', 'HOURLY', 'QUOTE']),
    basePriceMinor: money,
    hourlyRateMinor: money,
    minDurationMin: z.coerce.number().int().min(15).max(1440),
    maxDurationMin: z.coerce.number().int().min(15).max(1440),
    durationStepMin: z.coerce.number().int().min(5).max(1440),
    defaultDurationMin: z.coerce.number().int().min(15).max(1440),
    bufferMin: z.coerce.number().int().min(0).max(720),
    slotIntervalMin: z.coerce.number().int().min(5).max(720),
    requiresResource: z.boolean(),
    imageKey: text(120).optional().nullable(),
    isActive: z.boolean(),
    sortOrder: z.coerce.number().int().default(0),
    locationIds: z.array(z.string()).default([]),
    resourceIds: z.array(z.string()).default([]),
    addOnIds: z.array(z.string()).default([]),
  })
  .refine((s) => s.maxDurationMin >= s.minDurationMin, { message: 'Maximum duration must be at least the minimum', path: ['maxDurationMin'] })
  .refine((s) => s.defaultDurationMin >= s.minDurationMin && s.defaultDurationMin <= s.maxDurationMin, { message: 'Default duration must be within the min/max range', path: ['defaultDurationMin'] })
  .refine((s) => (s.pricingModel === 'QUOTE') === (s.bookingMode === 'ENQUIRY'), { message: 'Quotation pricing must be used with the enquiry booking mode (and vice versa)', path: ['pricingModel'] });

export const packageInputSchema = z.object({
    isDemo: z.boolean().optional(),
  serviceId: z.string().min(1),
  slug,
  name: text(120).min(2),
  description: text(2000).min(2),
  includes: z.array(text(200).min(1)).max(20).default([]),
  priceMinor: money,
  durationMin: z.coerce.number().int().min(15).max(1440),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const addOnInputSchema = z.object({
    isDemo: z.boolean().optional(),
  brand: brandSchema,
  slug,
  name: text(120).min(2),
  description: text(1000).optional().nullable(),
  pricing: z.enum(['FIXED', 'PER_HOUR']),
  priceMinor: money,
  isActive: z.boolean().default(true),
});

export const categoryInputSchema = z.object({
    isDemo: z.boolean().optional(),
  brand: brandSchema,
  slug,
  name: text(120).min(2),
  description: text(1000).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const locationInputSchema = z.object({
  slug,
  name: text(120).min(2),
  brands: z.array(brandSchema).min(1),
  addressLine1: text(200).min(2),
  addressLine2: text(200).optional().nullable(),
  city: text(120).min(2),
  region: text(120).optional().nullable(),
  postalCode: text(20).optional().nullable(),
  country: z.string().length(2).default('IN'),
  timezone: z.string().refine(isValidTimeZone, 'Unknown IANA timezone'),
  phone: text(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('').transform(() => null)),
  description: text(2000).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  imageKey: text(120).optional().nullable(),
  isActive: z.boolean().default(true),
  isDemo: z.boolean().default(false),
});

export const resourceInputSchema = z.object({
    isDemo: z.boolean().optional(),
  locationId: z.string().min(1),
  name: text(120).min(2),
  type: z.enum(['STUDIO', 'ROOM', 'EQUIPMENT', 'CREW', 'VENUE']),
  description: text(2000).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(100_000).optional().nullable(),
  isExclusive: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const openingHoursSchema = z.object({
  locationId: z.string().min(1),
  resourceId: z.string().min(1).optional().nullable(),
  hours: z
    .array(z.object({ dayOfWeek: z.coerce.number().int().min(0).max(6), open: z.string(), close: z.string() }))
    .max(28),
});

export const blockedPeriodSchema = z.object({
  locationId: z.string().min(1).optional().nullable(),
  resourceId: z.string().min(1).optional().nullable(),
  kind: z.enum(['CLOSURE', 'MAINTENANCE', 'HOLD', 'OTHER']),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  reason: text(500).optional().nullable(),
});

export const portfolioInputSchema = z.object({
  brand: brandSchema,
  slug,
  title: text(160).min(2),
  categoryId: optionalId,
  summary: text(500).min(2),
  body: text(10_000).min(2),
  coverImage: text(120).min(1),
  coverAlt: text(300).min(3),
  isSample: z.boolean().default(true),
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  images: z.array(z.object({ imageKey: text(120).min(1), alt: text(300).min(3), caption: text(300).optional().nullable() })).max(40).default([]),
});

export const faqInputSchema = z.object({
    isDemo: z.boolean().optional(),
  brand: brandSchema,
  question: text(300).min(5),
  answer: text(5000).min(5),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

async function audit(actor: Actor, action: string, entityType: string, entityId: string, summary: string, ctx: RequestContext, db: Db, before?: unknown, after?: unknown) {
  await recordAudit(actor, { action, entityType, entityId, summary, before, after }, ctx, db);
}

export async function upsertService(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = serviceInputSchema.parse(raw);
  const { locationIds, resourceIds, addOnIds, ...data } = input;
  if (data.categoryId) {
    const cat = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!cat || cat.brand !== data.brand) throw invalid('Category belongs to a different website.');
  }
  const locations = await db.location.findMany({ where: { id: { in: locationIds } } });
  if (locations.length !== locationIds.length || locations.some((l) => !l.brands.includes(data.brand))) throw invalid('All locations must serve this website.');
  const resources = await db.resource.findMany({ where: { id: { in: resourceIds } } });
  if (resources.length !== resourceIds.length || resources.some((r) => !locationIds.includes(r.locationId))) throw invalid('Resources must belong to the selected locations.');
  const addOns = await db.addOn.findMany({ where: { id: { in: addOnIds } } });
  if (addOns.length !== addOnIds.length || addOns.some((a) => a.brand !== data.brand)) throw invalid('Add-ons must belong to this website.');

  return db.$transaction(async (tx) => {
    const before = id ? await tx.service.findUnique({ where: { id } }) : null;
    if (id && !before) throw notFound('Service');
    const service = id
      ? await tx.service.update({ where: { id }, data })
      : await tx.service.create({ data: { ...data, isDemo: data.isDemo ?? false } });
    await tx.serviceLocation.deleteMany({ where: { serviceId: service.id } });
    await tx.serviceResource.deleteMany({ where: { serviceId: service.id } });
    await tx.serviceAddOn.deleteMany({ where: { serviceId: service.id } });
    if (locationIds.length) await tx.serviceLocation.createMany({ data: locationIds.map((locationId) => ({ serviceId: service.id, locationId })) });
    if (resourceIds.length) await tx.serviceResource.createMany({ data: resourceIds.map((resourceId) => ({ serviceId: service.id, resourceId })) });
    if (addOnIds.length) await tx.serviceAddOn.createMany({ data: addOnIds.map((addOnId) => ({ serviceId: service.id, addOnId })) });
    await audit(actor, id ? 'service.updated' : 'service.created', 'Service', service.id, service.name, ctx, tx, before, input);
    return service;
  });
}

export async function upsertPackage(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = packageInputSchema.parse(raw);
  const service = await db.service.findUnique({ where: { id: input.serviceId } });
  if (!service) throw notFound('Service');
  if (input.durationMin < service.minDurationMin || input.durationMin > service.maxDurationMin) {
    throw invalid(`Package duration must be within the service's ${service.minDurationMin}–${service.maxDurationMin} minute range.`);
  }
  const before = id ? await db.package.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound('Package');
  const pkg = id ? await db.package.update({ where: { id }, data: input }) : await db.package.create({ data: { ...input, isDemo: input.isDemo ?? false } });
  await audit(actor, id ? 'package.updated' : 'package.created', 'Package', pkg.id, pkg.name, ctx, db, before, input);
  return pkg;
}

export async function upsertAddOn(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = addOnInputSchema.parse(raw);
  const before = id ? await db.addOn.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound('Add-on');
  const row = id ? await db.addOn.update({ where: { id }, data: input }) : await db.addOn.create({ data: { ...input, isDemo: input.isDemo ?? false } });
  await audit(actor, id ? 'addon.updated' : 'addon.created', 'AddOn', row.id, row.name, ctx, db, before, input);
  return row;
}

export async function upsertCategory(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = categoryInputSchema.parse(raw);
  const before = id ? await db.category.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound('Category');
  const row = id ? await db.category.update({ where: { id }, data: input }) : await db.category.create({ data: { ...input, isDemo: input.isDemo ?? false } });
  await audit(actor, id ? 'category.updated' : 'category.created', 'Category', row.id, row.name, ctx, db, before, input);
  return row;
}

export async function upsertLocation(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = locationInputSchema.parse(raw);
  const before = id ? await db.location.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound('Location');
  const row = id ? await db.location.update({ where: { id }, data: input }) : await db.location.create({ data: input });
  await audit(actor, id ? 'location.updated' : 'location.created', 'Location', row.id, row.name, ctx, db, before, input);
  return row;
}

export async function upsertResource(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = resourceInputSchema.parse(raw);
  const before = id ? await db.resource.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound('Resource');
  if (before && before.locationId !== input.locationId) {
    const active = await db.booking.count({ where: { resourceId: id!, status: { in: [...ACTIVE_BOOKING_STATUSES] } } });
    if (active) throw new DomainError('CONFLICT', 'This resource has active bookings and cannot move to another location.');
  }
  const row = id ? await db.resource.update({ where: { id }, data: input }) : await db.resource.create({ data: { ...input, isDemo: input.isDemo ?? false } });
  await audit(actor, id ? 'resource.updated' : 'resource.created', 'Resource', row.id, row.name, ctx, db, before, input);
  return row;
}

/** Replace the weekly opening hours of a location (or one resource's override). */
export async function setOpeningHours(raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = openingHoursSchema.parse(raw);
  const rows = input.hours.map((h) => {
    const open = hhmmToMinutes(h.open);
    const close = hhmmToMinutes(h.close);
    if (open === null || close === null || close <= open) throw invalid(`Invalid hours for day ${h.dayOfWeek}: closing time must be after opening time.`);
    return { dayOfWeek: h.dayOfWeek, openMinute: open, closeMinute: close };
  });
  for (let d = 0; d < 7; d++) {
    const day = rows.filter((r) => r.dayOfWeek === d).sort((a, b) => a.openMinute - b.openMinute);
    for (let i = 1; i < day.length; i++) if (day[i]!.openMinute < day[i - 1]!.closeMinute) throw invalid('Opening-hour ranges on the same day must not overlap.');
  }
  if (input.resourceId) {
    const r = await db.resource.findUnique({ where: { id: input.resourceId } });
    if (!r || r.locationId !== input.locationId) throw invalid('Resource does not belong to this location.');
  }
  await db.$transaction(async (tx) => {
    await tx.openingHours.deleteMany({ where: { locationId: input.locationId, resourceId: input.resourceId ?? null } });
    if (rows.length) {
      await tx.openingHours.createMany({ data: rows.map((r) => ({ ...r, locationId: input.locationId, resourceId: input.resourceId ?? null, isDemo: false })) });
    }
    await audit(actor, 'opening_hours.updated', input.resourceId ? 'Resource' : 'Location', input.resourceId ?? input.locationId, 'Opening hours replaced', ctx, tx, undefined, input);
  });
}

/** Add a closure or maintenance block. Returns any active bookings that now overlap, for follow-up. */
export async function createBlockedPeriod(raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = blockedPeriodSchema.parse(raw);
  if (!input.locationId && !input.resourceId) throw invalid('Choose a location or a resource to block.');
  if (input.endsAt <= input.startsAt) throw invalid('The block must end after it starts.');
  const block = await db.blockedPeriod.create({ data: input });
  const conflicts = await db.booking.findMany({
    where: {
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.resourceId ? { resourceId: input.resourceId } : { locationId: input.locationId! }),
    },
    select: { id: true, reference: true, startsAt: true, status: true },
  });
  await audit(actor, 'blocked_period.created', 'BlockedPeriod', block.id, `${input.kind} block`, ctx, db, undefined, { ...input, conflicts: conflicts.map((c) => c.reference) });
  return { block, conflicts };
}

export async function deleteBlockedPeriod(id: string, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const before = await db.blockedPeriod.findUnique({ where: { id } });
  if (!before) throw notFound('Blocked period');
  await db.blockedPeriod.delete({ where: { id } });
  await audit(actor, 'blocked_period.deleted', 'BlockedPeriod', id, 'Block removed', ctx, db, before);
}

export async function upsertPortfolio(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const { images, ...data } = portfolioInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const before = id ? await tx.portfolioProject.findUnique({ where: { id } }) : null;
    if (id && !before) throw notFound('Portfolio project');
    const row = id ? await tx.portfolioProject.update({ where: { id }, data }) : await tx.portfolioProject.create({ data });
    await tx.portfolioImage.deleteMany({ where: { projectId: row.id } });
    if (images.length) await tx.portfolioImage.createMany({ data: images.map((img, i) => ({ ...img, projectId: row.id, sortOrder: i })) });
    await audit(actor, id ? 'portfolio.updated' : 'portfolio.created', 'PortfolioProject', row.id, row.title, ctx, tx, before, data);
    return row;
  });
}

export async function deletePortfolio(id: string, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const before = await db.portfolioProject.findUnique({ where: { id } });
  if (!before) throw notFound('Portfolio project');
  await db.portfolioProject.delete({ where: { id } });
  await audit(actor, 'portfolio.deleted', 'PortfolioProject', id, before.title, ctx, db, before);
}

export async function upsertFaq(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const input = faqInputSchema.parse(raw);
  const before = id ? await db.faq.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound('FAQ');
  const row = id ? await db.faq.update({ where: { id }, data: input }) : await db.faq.create({ data: { ...input, isDemo: input.isDemo ?? false } });
  await audit(actor, id ? 'faq.updated' : 'faq.created', 'Faq', row.id, row.question.slice(0, 80), ctx, db, before, input);
  return row;
}

export async function deleteFaq(id: string, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const before = await db.faq.findUnique({ where: { id } });
  if (!before) throw notFound('FAQ');
  await db.faq.delete({ where: { id } });
  await audit(actor, 'faq.deleted', 'Faq', id, before.question.slice(0, 80), ctx, db, before);
}
