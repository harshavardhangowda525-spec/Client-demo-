import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@studio/db';
import {
  createEnquiry,
  createEnquirySchema,
  DomainError,
  getContentPage,
  getStudioCategories,
  getStudioHome,
  getStudioPortfolio,
  getStudioService,
  listSavedServices,
  listStudioServices,
  notifyEnquiryReceived,
  requestReschedule,
  saveEnquiryAttachment,
  searchStudio,
  setSavedService,
  studioCities,
  getShowtimes,
  listServiceReviews,
  listPublicOffers,
  submitReview,
  reviewInputSchema,
  getTicket,
  studioListingQuerySchema,
  updateNotificationPreferences,
  getOwnProfile,
  MAX_ATTACHMENT_BYTES,
} from '@studio/core';
import { defineRoute, getActor, registry, requestContext } from '../http/registry';

const tokenQuery = z.object({ token: z.string().max(200).optional() });
const accessTokenFrom = (headers: Record<string, unknown>, query?: { token?: string }) => {
  const h = headers['x-booking-token'];
  return (typeof h === 'string' ? h : undefined) ?? query?.token ?? null;
};

export function registerStudioRoutes(app: FastifyInstance) {
  // --- Discovery -----------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/home', summary: 'Studio home page: banners, categories, popular/featured services (with real next availability), packages, facilities, portfolio, testimonials, FAQs', tags: ['Studio'], access: 'public',
    query: z.object({ city: z.string().max(80).optional() }), rateLimit: { max: 120, timeWindow: '1 minute' },
    handler: ({ query }) => getStudioHome(query.city),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/search', summary: 'Search services, packages, categories and equipment', tags: ['Studio'], access: 'public',
    query: z.object({ q: z.string().max(100).default('') }), rateLimit: { max: 120, timeWindow: '1 minute' },
    handler: ({ query }) => searchStudio(query.q),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/categories', summary: 'Browsing categories', tags: ['Studio'], access: 'public',
    handler: () => getStudioCategories(),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/cities', summary: 'Cities with an active studio location (for the location selector)', tags: ['Studio'], access: 'public',
    handler: () => studioCities(),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/services', summary: 'Service listing with filters (category, text, price, duration, city, equipment, type, available date), sorting and pagination', tags: ['Studio'], access: 'public',
    query: studioListingQuerySchema, rateLimit: { max: 120, timeWindow: '1 minute' },
    handler: ({ query }) => listStudioServices(query),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/services/:slug', summary: 'Service detail: packages, add-ons, equipment, locations, policy, portfolio, related services', tags: ['Studio'], access: 'public',
    params: z.object({ slug: z.string().max(80) }),
    handler: ({ params }) => getStudioService(params.slug),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/portfolio', summary: 'Portfolio (images and videos) with category filter', tags: ['Studio'], access: 'public',
    query: z.object({ category: z.string().max(80).optional() }),
    handler: ({ query }) => getStudioPortfolio(query.category),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/pages/:slug', summary: 'Policy / information page (privacy, terms, cancellation-refund)', tags: ['Studio'], access: 'public',
    params: z.object({ slug: z.string().max(60) }),
    handler: async ({ params }) => {
      const p = await getContentPage(params.slug);
      return { slug: p.slug, title: p.title, body: p.body, isTemplate: p.isTemplate, updatedAt: p.updatedAt };
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/services/:slug/showtimes', summary: 'Free start times for a date at every studio offering the service, plus which upcoming days have free times', tags: ['Studio'], access: 'public',
    params: z.object({ slug: z.string().max(80) }),
    query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), packageId: z.string().max(64).optional(), durationMin: z.coerce.number().int().min(15).max(1440).optional(), city: z.string().max(80).optional() }),
    rateLimit: { max: 120, timeWindow: '1 minute' },
    handler: ({ params, query }) => getShowtimes(params.slug, query),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/services/:slug/reviews', summary: 'Published reviews from customers who completed a booking (rating summary and latest reviews)', tags: ['Studio'], access: 'public',
    params: z.object({ slug: z.string().max(80) }), query: z.object({ page: z.coerce.number().int().min(1).max(100).default(1) }),
    handler: async ({ params, query }) => {
      const s = await prisma.service.findFirst({ where: { slug: params.slug, isActive: true }, select: { id: true } });
      if (!s) throw new DomainError('NOT_FOUND', 'Service not found.');
      return listServiceReviews(s.id, { take: 10, skip: (query.page - 1) * 10 });
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/studio/offers', summary: 'Current offers and coupon codes shown on the website', tags: ['Studio'], access: 'public',
    handler: () => listPublicOffers(),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/bookings/:reference/review', summary: 'Rate and review a booking after the session (one review per booking; resubmitting edits it)', tags: ['Booking'], access: 'public',
    params: z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z]{2}-[0-9A-Z]{8}$/) }), query: tokenQuery,
    body: reviewInputSchema, status: 201, rateLimit: { max: 10, timeWindow: '10 minutes' },
    handler: async ({ params, query, body, actor, req, ctx }) => {
      const r = await submitReview(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) }, body, ctx);
      return { rating: r.rating, comment: r.comment, status: r.status };
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/bookings/:reference/ticket', summary: 'E-ticket with the signed check-in code (confirmed bookings only)', tags: ['Booking'], access: 'public',
    params: z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z]{2}-[0-9A-Z]{8}$/) }), query: tokenQuery,
    handler: ({ params, query, actor, req }) => getTicket(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) }),
  });

  // --- Project enquiries ------------------------------------------------------------
  defineRoute(app, {
    method: 'POST', url: '/api/v1/studio/enquiries', summary: 'Submit a project brief for a custom quotation (not a booking)', tags: ['Studio'], access: 'public',
    body: createEnquirySchema, status: 201, rateLimit: { max: 10, timeWindow: '10 minutes' },
    handler: async ({ body, actor, ctx }) => {
      // The enquiry belongs to the website brand of the requested services.
      const services = body.serviceIds.length ? await prisma.service.findMany({ where: { id: { in: body.serviceIds } }, select: { brand: true } }) : [];
      const brands = [...new Set(services.map((s) => s.brand))];
      if (brands.length > 1) throw new DomainError('VALIDATION', 'Please send a separate brief for each type of service (photography & video, podcast, or events).');
      const brand = (brands[0] ?? 'PHOTO') as 'PHOTO' | 'PODCAST' | 'EVENTS';
      if (!['PHOTO', 'PODCAST', 'EVENTS'].includes(brand)) throw new DomainError('VALIDATION', 'One or more requested services are unavailable.');
      const { enquiry, accessToken } = await createEnquiry(body, actor, ctx, prisma, new Date(), brand, 'STUDIO');
      await notifyEnquiryReceived(enquiry, accessToken);
      return { reference: enquiry.reference, status: enquiry.status, accessToken };
    },
  });

  // Multipart upload; registered directly because the body is a file stream.
  app.post('/api/v1/enquiries/:reference/attachments', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { reference } = z.object({ reference: z.string().trim().toUpperCase().regex(/^EQ-[0-9A-Z]{8}$/) }).parse(req.params);
    const query = tokenQuery.parse(req.query ?? {});
    const file = await req.file({ limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 } });
    if (!file) throw new DomainError('VALIDATION', 'Choose a file to upload.');
    const data = await file.toBuffer().catch(() => {
      throw new DomainError('VALIDATION', 'Files must be 10 MB or smaller.');
    });
    if (file.file.truncated) throw new DomainError('VALIDATION', 'Files must be 10 MB or smaller.');
    const actor = await getActor(req);
    const saved = await saveEnquiryAttachment(reference, { actor, accessToken: accessTokenFrom(req.headers, query) }, { filename: file.filename, data }, requestContext(req));
    reply.status(201);
    return saved;
  });

  registry.push({
    method: 'POST', url: '/api/v1/enquiries/:reference/attachments', summary: 'Attach a file to an enquiry (multipart field "file"; PDF/JPG/PNG/WebP, max 10 MB, max 5 per enquiry; type detected from content). Requires the enquiry access token or ownership.', tags: ['Studio'], access: 'public', status: 201,
    handler: async () => undefined,
  });

  // --- Booking changes ------------------------------------------------------------------
  defineRoute(app, {
    method: 'POST', url: '/api/v1/bookings/:reference/reschedule-requests', summary: 'Ask to move a booking (the team approves; original slot stays reserved until then)', tags: ['Booking'], access: 'public',
    params: z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z]{2}-[0-9A-Z]{8}$/) }), query: tokenQuery,
    body: z.object({ date: z.string(), startTime: z.string(), reason: z.string().max(500).optional() }), status: 201,
    rateLimit: { max: 10, timeWindow: '10 minutes' },
    handler: async ({ params, query, body, actor, req, ctx }) => {
      const r = await requestReschedule(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) }, body, ctx);
      return { id: r.id, status: r.status, requestedStart: r.requestedStart };
    },
  });

  // --- Customer account ---------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/me/saved', summary: 'Saved services', tags: ['Account'], access: 'customer',
    handler: ({ actor }) => listSavedServices(actor!),
  });
  defineRoute(app, {
    method: 'PUT', url: '/api/v1/me/saved/:serviceId', summary: 'Save a service', tags: ['Account'], access: 'customer',
    params: z.object({ serviceId: z.string().max(64) }),
    handler: ({ actor, params }) => setSavedService(actor!, params.serviceId, true),
  });
  defineRoute(app, {
    method: 'DELETE', url: '/api/v1/me/saved/:serviceId', summary: 'Remove a saved service', tags: ['Account'], access: 'customer',
    params: z.object({ serviceId: z.string().max(64) }),
    handler: ({ actor, params }) => setSavedService(actor!, params.serviceId, false),
  });
  defineRoute(app, {
    method: 'GET', url: '/api/v1/me/preferences', summary: 'Notification preferences', tags: ['Account'], access: 'customer',
    handler: async ({ actor }) => {
      const p = await getOwnProfile(actor!);
      return { notifyEmail: p.notifyEmail, notifyWhatsapp: p.notifyWhatsapp, whatsappConsentAt: p.whatsappConsentAt?.toISOString() ?? null };
    },
  });
  defineRoute(app, {
    method: 'PATCH', url: '/api/v1/me/preferences', summary: 'Update notification preferences (WhatsApp requires consent)', tags: ['Account'], access: 'customer',
    body: z.object({ notifyEmail: z.boolean(), notifyWhatsapp: z.boolean(), whatsappConsent: z.boolean().optional() }),
    handler: ({ actor, body, ctx }) => updateNotificationPreferences(actor!, body, ctx),
  });
}
