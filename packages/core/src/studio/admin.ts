import { z } from 'zod';
import { prisma, type Db } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { invalid, notFound } from '../errors';
import { TEMPLATE_DEFINITIONS, type TemplateKey } from '../notifications/templates';

const text = (max: number) => z.string().trim().max(max);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens').max(80);
// Internal paths or https URLs only (no javascript: or protocol-relative links).
const href = z.string().trim().max(300).refine((v) => (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\//.test(v), 'Use a site path starting with / or an https:// link');

export const bannerInputSchema = z.object({
  title: text(120).min(2),
  subtitle: text(300).optional().nullable(),
  imageKey: text(120).min(1),
  imageAlt: text(300).min(3),
  ctaLabel: text(40).min(2),
  ctaHref: href,
  offerText: text(120).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});

export const discoveryCategoryInputSchema = z.object({
  slug,
  name: text(80).min(2),
  description: text(500).optional().nullable(),
  imageKey: text(120).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  isDemo: z.boolean().optional(),
});

export const equipmentInputSchema = z.object({
  name: text(120).min(2),
  category: text(80).min(2),
  description: text(1000).optional().nullable(),
  imageKey: text(120).optional().nullable(),
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const testimonialInputSchema = z
  .object({
    quote: text(1000).min(10),
    authorName: text(120).min(2),
    authorDetail: text(160).optional().nullable(),
    serviceId: z.string().max(64).optional().nullable(),
    isAuthorized: z.boolean().default(false),
    isPublished: z.boolean().default(false),
    sortOrder: z.coerce.number().int().default(0),
  })
  .refine((t) => !t.isPublished || t.isAuthorized, { message: 'A testimonial can only be published once the customer has authorised it.', path: ['isPublished'] });

export const contentPageInputSchema = z.object({ title: text(160).min(2), body: text(30_000).min(10), isTemplate: z.boolean().default(false) });

export const templateInputSchema = z.object({ subject: text(200).min(2), body: text(5000).min(5), isActive: z.boolean().default(true) });

async function audit(actor: Actor, action: string, entityType: string, entityId: string, summary: string, ctx: RequestContext, db: Db, after?: unknown) {
  await recordAudit(actor, { action, entityType, entityId, summary, after }, ctx, db);
}

export async function upsertBanner(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const input = bannerInputSchema.parse(raw);
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw invalid('The banner must end after it starts.');
  if (id && !(await db.homeBanner.findUnique({ where: { id } }))) throw notFound('Banner');
  const row = id ? await db.homeBanner.update({ where: { id }, data: input }) : await db.homeBanner.create({ data: input });
  await audit(actor, id ? 'banner.updated' : 'banner.created', 'HomeBanner', row.id, row.title, ctx, db, input);
  return row;
}

export async function deleteBanner(id: string, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const row = await db.homeBanner.findUnique({ where: { id } });
  if (!row) throw notFound('Banner');
  await db.homeBanner.delete({ where: { id } });
  await audit(actor, 'banner.deleted', 'HomeBanner', id, row.title, ctx, db);
}

export async function upsertDiscoveryCategory(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const input = discoveryCategoryInputSchema.parse(raw);
  if (id && !(await db.discoveryCategory.findUnique({ where: { id } }))) throw notFound('Category');
  const row = id ? await db.discoveryCategory.update({ where: { id }, data: input }) : await db.discoveryCategory.create({ data: { ...input, isDemo: input.isDemo ?? false } });
  await audit(actor, id ? 'discovery_category.updated' : 'discovery_category.created', 'DiscoveryCategory', row.id, row.name, ctx, db, input);
  return row;
}

export async function upsertEquipment(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const input = equipmentInputSchema.parse(raw);
  if (id && !(await db.equipment.findUnique({ where: { id } }))) throw notFound('Equipment');
  const row = id ? await db.equipment.update({ where: { id }, data: input }) : await db.equipment.create({ data: input });
  await audit(actor, id ? 'equipment.updated' : 'equipment.created', 'Equipment', row.id, row.name, ctx, db, input);
  return row;
}

export async function upsertTestimonial(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const input = testimonialInputSchema.parse(raw);
  if (id && !(await db.testimonial.findUnique({ where: { id } }))) throw notFound('Testimonial');
  const row = id ? await db.testimonial.update({ where: { id }, data: input }) : await db.testimonial.create({ data: input });
  await audit(actor, id ? 'testimonial.updated' : 'testimonial.created', 'Testimonial', row.id, row.authorName, ctx, db, { isPublished: input.isPublished, isAuthorized: input.isAuthorized });
  return row;
}

export async function deleteTestimonial(id: string, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const row = await db.testimonial.findUnique({ where: { id } });
  if (!row) throw notFound('Testimonial');
  await db.testimonial.delete({ where: { id } });
  await audit(actor, 'testimonial.deleted', 'Testimonial', id, row.authorName, ctx, db);
}

export async function updateContentPage(slugValue: string, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const input = contentPageInputSchema.parse(raw);
  const row = await db.contentPage.upsert({ where: { slug: slugValue }, create: { slug: slugValue, ...input }, update: input });
  await audit(actor, 'content_page.updated', 'ContentPage', slugValue, row.title, ctx, db);
  return row;
}

export async function listTemplates(db: Db = prisma) {
  const overrides = await db.notificationTemplate.findMany();
  return TEMPLATE_DEFINITIONS.map((d) => {
    const o = overrides.find((x) => x.key === d.key);
    return { key: d.key, description: d.description, variables: d.variables, defaultSubject: d.subject, defaultBody: d.body, subject: o?.subject ?? d.subject, body: o?.body ?? d.body, isCustomised: !!o, isActive: o?.isActive ?? true };
  });
}

export async function saveTemplate(key: string, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  const def = TEMPLATE_DEFINITIONS.find((d) => d.key === key);
  if (!def) throw notFound('Template');
  const input = templateInputSchema.parse(raw);
  const unknownVars = [...`${input.subject} ${input.body}`.matchAll(/\{\{\s*([a-zA-Z]+)\s*\}\}/g)].map((m) => m[1]!).filter((v) => !def.variables.includes(v));
  if (unknownVars.length) throw invalid(`Unknown placeholder(s): ${[...new Set(unknownVars)].join(', ')}. Available: ${def.variables.join(', ')}.`);
  const row = await db.notificationTemplate.upsert({ where: { key }, create: { key: key as TemplateKey, ...input }, update: input });
  await audit(actor, 'template.updated', 'NotificationTemplate', key, def.description, ctx, db);
  return row;
}

export async function resetTemplate(key: string, actor: Actor, ctx: RequestContext = {}, db: Db = prisma) {
  await db.notificationTemplate.deleteMany({ where: { key } });
  await audit(actor, 'template.reset', 'NotificationTemplate', key, 'Reset to default', ctx, db);
}
