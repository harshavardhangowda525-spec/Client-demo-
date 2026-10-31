import { createReadStream, existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@studio/db';
import {
  decideReschedule,
  deleteBanner,
  deleteTestimonial,
  DomainError,
  getAttachmentForStaff,
  listRescheduleRequests,
  listTemplates,
  recordAudit,
  resetTemplate,
  saveTemplate,
  sendUpcomingReminders,
  updateContentPage,
  upsertBanner,
  upsertDiscoveryCategory,
  upsertEquipment,
  upsertTestimonial,
  listOffersAdmin,
  upsertOffer,
  listReviewsAdmin,
  moderateReview,
  checkIn,
} from '@studio/core';
import { defineRoute, getActor, registry, requestContext } from '../http/registry';

const idParam = z.object({ id: z.string().min(1).max(64) });
const anyBody = z.record(z.string(), z.unknown());

export function registerAdminStudioRoutes(app: FastifyInstance) {
  const crud = (
    path: string,
    label: string,
    access: 'content.manage' | 'catalog.manage',
    list: () => Promise<unknown>,
    upsert: (id: string | null, body: unknown, actor: never, ctx: never) => Promise<unknown>,
    remove?: (id: string, actor: never, ctx: never) => Promise<void>,
  ) => {
    defineRoute(app, { method: 'GET', url: `/api/v1/admin/${path}`, summary: `List ${label}`, tags: ['Admin: studio site'], access, handler: list });
    defineRoute(app, { method: 'POST', url: `/api/v1/admin/${path}`, summary: `Create ${label}`, tags: ['Admin: studio site'], access, body: anyBody, status: 201, handler: ({ body, actor, ctx }) => upsert(null, body, actor as never, ctx as never) });
    defineRoute(app, { method: 'PUT', url: `/api/v1/admin/${path}/:id`, summary: `Update ${label}`, tags: ['Admin: studio site'], access, params: idParam, body: anyBody, handler: ({ params, body, actor, ctx }) => upsert(params.id, body, actor as never, ctx as never) });
    if (remove) {
      defineRoute(app, { method: 'DELETE', url: `/api/v1/admin/${path}/:id`, summary: `Delete ${label}`, tags: ['Admin: studio site'], access, params: idParam, handler: async ({ params, actor, ctx }) => { await remove(params.id, actor as never, ctx as never); return { ok: true }; } });
    }
  };

  crud('banners', 'home banners', 'content.manage', () => prisma.homeBanner.findMany({ orderBy: { sortOrder: 'asc' } }), upsertBanner, deleteBanner);
  crud('discovery-categories', 'browsing categories', 'content.manage', () => prisma.discoveryCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { services: true } } } }), upsertDiscoveryCategory);
  crud('equipment', 'equipment & facilities', 'catalog.manage', () => prisma.equipment.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { services: true } } } }), upsertEquipment);
  crud('testimonials', 'testimonials', 'content.manage', () => prisma.testimonial.findMany({ orderBy: { sortOrder: 'asc' }, include: { service: { select: { name: true } } } }), upsertTestimonial, deleteTestimonial);

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/pages', summary: 'Policy and information pages', tags: ['Admin: studio site'], access: 'content.manage',
    handler: () => prisma.contentPage.findMany({ orderBy: { slug: 'asc' } }),
  });
  defineRoute(app, {
    method: 'PUT', url: '/api/v1/admin/pages/:slug', summary: 'Update a policy page', tags: ['Admin: studio site'], access: 'content.manage',
    params: z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/) }), body: anyBody,
    handler: ({ params, body, actor, ctx }) => updateContentPage(params.slug, body, actor!, ctx),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/templates', summary: 'Notification templates (defaults and overrides)', tags: ['Admin: settings'], access: 'settings.read',
    handler: () => listTemplates(),
  });
  defineRoute(app, {
    method: 'PUT', url: '/api/v1/admin/templates/:key', summary: 'Override a notification template', tags: ['Admin: settings'], access: 'settings.manage',
    params: z.object({ key: z.string().max(60) }), body: anyBody,
    handler: ({ params, body, actor, ctx }) => saveTemplate(params.key, body, actor!, ctx),
  });
  defineRoute(app, {
    method: 'DELETE', url: '/api/v1/admin/templates/:key', summary: 'Reset a template to its default', tags: ['Admin: settings'], access: 'settings.manage',
    params: z.object({ key: z.string().max(60) }),
    handler: async ({ params, actor, ctx }) => { await resetTemplate(params.key, actor!, ctx); return { ok: true }; },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/reschedule-requests', summary: 'Customer reschedule requests', tags: ['Admin: bookings'], access: 'bookings.read',
    query: z.object({ status: z.enum(['PENDING', 'APPROVED', 'DECLINED']).optional() }),
    handler: ({ query }) => listRescheduleRequests(query.status),
  });
  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/reschedule-requests/:id/decide', summary: 'Approve (re-checks availability) or decline a reschedule request', tags: ['Admin: bookings'], access: 'bookings.manage',
    params: idParam, body: z.object({ approve: z.boolean(), note: z.string().max(500).optional() }),
    handler: ({ params, body, actor, ctx }) => decideReschedule(params.id, body.approve, body.note, actor!, ctx),
  });

  // --- Offers & coupons -------------------------------------------------------------------
  defineRoute(app, { method: 'GET', url: '/api/v1/admin/offers', summary: 'Offers and coupon codes with redemption counts', tags: ['Admin: offers'], access: 'catalog.read', handler: () => listOffersAdmin() });
  defineRoute(app, { method: 'POST', url: '/api/v1/admin/offers', summary: 'Create an offer / coupon code', tags: ['Admin: offers'], access: 'catalog.manage', body: anyBody, status: 201, handler: ({ body, actor, ctx }) => upsertOffer(null, body, actor!, ctx) });
  defineRoute(app, { method: 'PUT', url: '/api/v1/admin/offers/:id', summary: 'Update an offer / coupon code', tags: ['Admin: offers'], access: 'catalog.manage', params: idParam, body: anyBody, handler: ({ params, body, actor, ctx }) => upsertOffer(params.id, body, actor!, ctx) });

  // --- Reviews moderation ------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/reviews', summary: 'Customer reviews (published and hidden)', tags: ['Admin: reviews'], access: 'content.manage',
    query: z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']).optional() }),
    handler: ({ query }) => listReviewsAdmin(query.status),
  });
  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/reviews/:id/moderate', summary: 'Hide a review (reason required) or show it again; review text cannot be edited', tags: ['Admin: reviews'], access: 'content.manage',
    params: idParam, body: z.object({ publish: z.boolean(), reason: z.string().max(300).optional() }),
    handler: ({ params, body, actor, ctx }) => moderateReview(params.id, body.publish, body.reason, actor!, ctx),
  });

  // --- E-ticket check-in -----------------------------------------------------------------------
  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/check-in', summary: 'Check a customer in by scanning or typing their e-ticket code (safe to repeat)', tags: ['Admin: bookings'], access: 'bookings.manage',
    body: z.object({ code: z.string().trim().min(5).max(40) }), rateLimit: { max: 60, timeWindow: '1 minute' },
    handler: ({ body, actor, ctx }) => checkIn(body.code, actor!, ctx),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/reminders/run', summary: 'Send reminders for confirmed sessions in the next 24 hours (idempotent)', tags: ['Admin: bookings'], access: 'bookings.manage',
    handler: () => sendUpcomingReminders(24),
  });

  registry.push({ method: 'GET', url: '/api/v1/admin/attachments/:id', summary: 'Download an enquiry attachment (always as a download, never inline)', tags: ['Admin: enquiries'], access: 'enquiries.read', handler: async () => undefined });

  // Staff-only file download. Served as an attachment with nosniff so it is never rendered inline.
  app.get('/api/v1/admin/attachments/:id', async (req, reply) => {
    const actor = await getActor(req);
    if (!actor) throw new DomainError('UNAUTHENTICATED', 'Sign in required.');
    if (!actor.isStaff || !actor.permissions.has('enquiries.read')) throw new DomainError('FORBIDDEN', 'You do not have permission to perform this action.');
    const { id } = idParam.parse(req.params);
    const { record, path } = await getAttachmentForStaff(id);
    if (!existsSync(path)) throw new DomainError('NOT_FOUND', 'The file is no longer available on this server.');
    await recordAudit(actor, { action: 'enquiry.attachment_downloaded', entityType: 'EventEnquiry', entityId: record.enquiryId, summary: record.fileName }, requestContext(req));
    reply
      .header('Content-Type', record.mimeType)
      .header('Content-Disposition', `attachment; filename="${record.fileName.replace(/["\\]/g, '_')}"`)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, no-store');
    return reply.send(createReadStream(path));
  });
}
