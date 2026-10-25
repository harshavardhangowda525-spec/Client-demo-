import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@studio/db';
import {
  availabilityQuerySchema,
  bookingLookupSchema,
  brandSchema,
  confirmRazorpayCheckout,
  syncRazorpayPayments,
  contactMessageSchema,
  createBooking,
  createBookingSchema,
  createEnquiry,
  createEnquirySchema,
  customerCancel,
  getAvailability,
  getBookingForViewer,
  getCatalog,
  getEnquiryForViewer,
  getFaqs,
  getLocations,
  getPortfolio,
  getPortfolioProject,
  getServiceBySlug,
  getSiteConfig,
  lookupBookingStatus,
  notifyBookingCreated,
  notifyBookingStatus,
  notifyEnquiryReceived,
  notifyPayment,
  notifySafely,
  paymentStartSchema,
  quoteRequestSchema,
  quoteService,
  respondToQuotation,
  simulateDemoPayment,
  startPayment,
  getSetting,
  DomainError,
} from '@studio/core';
import { defineRoute } from '../http/registry';
import { customerBookingDto } from '../dto';

const brandParam = z.object({ brand: brandSchema });
const referenceParam = z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z]{2}-[0-9A-Z]{8}$/) });
const tokenQuery = z.object({ token: z.string().max(200).optional() });

/** Guest access token, from the X-Booking-Token header (preferred) or ?token=. */
function accessTokenFrom(headers: Record<string, unknown>, query?: { token?: string }) {
  const h = headers['x-booking-token'];
  return (typeof h === 'string' ? h : undefined) ?? query?.token ?? null;
}

export function registerPublicRoutes(app: FastifyInstance) {
  defineRoute(app, {
    method: 'GET', url: '/api/v1/sites/:brand', summary: 'Site configuration, business details and integration flags', tags: ['Catalogue'], access: 'public',
    params: brandParam,
    handler: ({ params }) => getSiteConfig(params.brand),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/sites/:brand/catalog', summary: 'Categories, services, packages and add-ons for a website', tags: ['Catalogue'], access: 'public',
    params: brandParam,
    handler: ({ params }) => getCatalog(params.brand),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/sites/:brand/services/:slug', summary: 'One service with packages and add-ons', tags: ['Catalogue'], access: 'public',
    params: z.object({ brand: brandSchema, slug: z.string().max(80) }),
    handler: ({ params }) => getServiceBySlug(params.brand, params.slug),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/sites/:brand/locations', summary: 'Locations, opening hours and resources', tags: ['Catalogue'], access: 'public',
    params: brandParam,
    handler: ({ params }) => getLocations(params.brand),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/sites/:brand/portfolio', summary: 'Portfolio or gallery projects', tags: ['Content'], access: 'public',
    params: brandParam, query: z.object({ category: z.string().max(80).optional() }),
    handler: ({ params, query }) => getPortfolio(params.brand, query.category),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/sites/:brand/portfolio/:slug', summary: 'Portfolio project detail', tags: ['Content'], access: 'public',
    params: z.object({ brand: brandSchema, slug: z.string().max(80) }),
    handler: ({ params }) => getPortfolioProject(params.brand, params.slug),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/sites/:brand/faqs', summary: 'Frequently asked questions', tags: ['Content'], access: 'public',
    params: brandParam,
    handler: ({ params }) => getFaqs(params.brand),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/availability', summary: 'Bookable slots for a service at a location (server-verified)', tags: ['Booking'], access: 'public',
    query: availabilityQuerySchema, rateLimit: { max: 120, timeWindow: '1 minute' },
    handler: async ({ query }) => {
      const r = await getAvailability(query);
      return {
        ...r,
        days: r.days.map((d) => ({ date: d.date, isOpen: d.isOpen, slots: d.slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime, start: s.start, end: s.end, available: s.availableResourceIds.length || 1 })) })),
      };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/quotes', summary: 'Itemised price for a service, package, duration and add-ons', tags: ['Booking'], access: 'public',
    body: quoteRequestSchema, rateLimit: { max: 120, timeWindow: '1 minute' },
    handler: async ({ body }) => (await quoteService(body)).breakdown,
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/bookings', summary: 'Create a booking (availability and price are re-verified on the server)', tags: ['Booking'], access: 'public',
    body: createBookingSchema, status: 201, rateLimit: { max: 20, timeWindow: '10 minutes' },
    handler: async ({ body, actor, ctx }) => {
      const { booking, accessToken } = await createBooking(body, actor, ctx);
      await notifyBookingCreated(booking, accessToken);
      const full = await getBookingForViewer(booking.reference, { actor, accessToken });
      return { booking: customerBookingDto(full), accessToken };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/bookings/lookup', summary: 'Look up booking status by reference and email (minimal summary)', tags: ['Booking'], access: 'public',
    body: bookingLookupSchema, rateLimit: { max: 10, timeWindow: '15 minutes' },
    handler: ({ body }) => lookupBookingStatus(body.reference, body.email),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/bookings/:reference', summary: 'Booking detail for its owner, a staff member or a guest with the access token', tags: ['Booking'], access: 'public',
    params: referenceParam, query: tokenQuery, rateLimit: { max: 60, timeWindow: '1 minute' },
    handler: async ({ params, query, actor, req }) => customerBookingDto(await getBookingForViewer(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) })),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/bookings/:reference/cancel', summary: 'Cancel an unpaid booking or request cancellation of a paid one', tags: ['Booking'], access: 'public',
    params: referenceParam, query: tokenQuery, body: z.object({ reason: z.string().trim().max(500).optional() }), rateLimit: { max: 10, timeWindow: '10 minutes' },
    handler: async ({ params, query, body, actor, req }) => {
      const updated = await customerCancel(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) }, body.reason);
      await notifyBookingStatus(updated, body.reason);
      return customerBookingDto(await getBookingForViewer(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) }));
    },
  });

  // --- Payments ------------------------------------------------------------------
  defineRoute(app, {
    method: 'POST', url: '/api/v1/bookings/:reference/payments', summary: 'Start checkout (demo or Razorpay). Send an Idempotency-Key header.', tags: ['Payments'], access: 'public',
    params: referenceParam, query: tokenQuery, body: paymentStartSchema, rateLimit: { max: 20, timeWindow: '10 minutes' },
    handler: async ({ params, query, body, actor, req, ctx }) => {
      const key = req.headers['idempotency-key'];
      const { order, checkout } = await startPayment(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) }, body.purpose, typeof key === 'string' ? key : undefined, ctx);
      return { orderId: order.id, status: order.status, checkout };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/payments/demo/:orderId/simulate', summary: 'DEMO MODE ONLY: simulate the provider result for a demo order. No money moves.', tags: ['Payments'], access: 'public',
    params: z.object({ orderId: z.string().min(1).max(64) }), query: tokenQuery, body: z.object({ outcome: z.enum(['success', 'failure']) }), rateLimit: { max: 20, timeWindow: '10 minutes' },
    handler: async ({ params, query, body, actor, req, ctx }) => {
      const viewer = { actor, accessToken: accessTokenFrom(req.headers, query) };
      await simulateDemoPayment(params.orderId, body.outcome, viewer, ctx);
      const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: params.orderId }, include: { booking: true } });
      await notifyPayment(order.booking, order.status === 'SUCCEEDED', order.amountMinor, true);
      if (order.booking.status === 'CONFIRMED') await notifyBookingStatus(order.booking);
      return { orderStatus: order.status, simulated: true, booking: customerBookingDto(await getBookingForViewer(order.booking.reference, viewer)) };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/bookings/:reference/payments/sync', summary: 'Ask Razorpay for the outcome of open payments on this booking (covers checkouts whose browser never returned)', tags: ['Payments'], access: 'public',
    params: z.object({ reference: z.string().trim().toUpperCase().regex(/^[A-Z]{2}-[0-9A-Z]{8}$/) }), query: tokenQuery,
    rateLimit: { max: 30, timeWindow: '10 minutes' },
    handler: async ({ params, query, actor, req }) => {
      const viewer = { actor, accessToken: accessTokenFrom(req.headers, query) };
      const result = await syncRazorpayPayments(params.reference, viewer);
      return { ...result, booking: customerBookingDto(await getBookingForViewer(params.reference, viewer)) };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/payments/razorpay/:orderId/confirm', summary: 'Razorpay checkout callback: verifies the signature, then confirms status with the Razorpay API', tags: ['Payments'], access: 'public',
    params: z.object({ orderId: z.string().min(1).max(64) }), query: tokenQuery,
    body: z.object({ razorpay_order_id: z.string().max(64), razorpay_payment_id: z.string().max(64), razorpay_signature: z.string().max(256) }),
    rateLimit: { max: 20, timeWindow: '10 minutes' },
    handler: async ({ params, query, body, actor, req }) => {
      const viewer = { actor, accessToken: accessTokenFrom(req.headers, query) };
      await confirmRazorpayCheckout(params.orderId, body, viewer);
      const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: params.orderId }, include: { booking: true } });
      return { orderStatus: order.status, simulated: false, booking: customerBookingDto(await getBookingForViewer(order.booking.reference, viewer)) };
    },
  });

  // --- Enquiries -------------------------------------------------------------------
  defineRoute(app, {
    method: 'POST', url: '/api/v1/enquiries', summary: 'Submit an event enquiry (not a booking)', tags: ['Enquiries'], access: 'public',
    body: createEnquirySchema, status: 201, rateLimit: { max: 10, timeWindow: '10 minutes' },
    handler: async ({ body, actor, ctx }) => {
      const { enquiry, accessToken } = await createEnquiry(body, actor, ctx);
      await notifyEnquiryReceived(enquiry, accessToken);
      return { reference: enquiry.reference, status: enquiry.status, accessToken };
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/enquiries/:reference', summary: 'Enquiry status and sent proposals for the customer', tags: ['Enquiries'], access: 'public',
    params: z.object({ reference: z.string().trim().toUpperCase().regex(/^EQ-[0-9A-Z]{8}$/) }), query: tokenQuery, rateLimit: { max: 60, timeWindow: '1 minute' },
    handler: async ({ params, query, actor, req }) => {
      const e = await getEnquiryForViewer(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) });
      return {
        reference: e.reference,
        status: e.status,
        eventType: e.eventType,
        category: e.category?.name ?? null,
        preferredDate: e.preferredDate.toISOString().slice(0, 10),
        alternateDate: e.alternateDate?.toISOString().slice(0, 10) ?? null,
        location: e.location ? { name: e.location.name, city: e.location.city } : null,
        venueDetails: e.venueDetails,
        expectedAttendance: e.expectedAttendance,
        services: e.services.map((s) => s.service.name),
        budgetMinMinor: e.budgetMinMinor,
        budgetMaxMinor: e.budgetMaxMinor,
        contact: { name: e.contactName, email: e.contactEmail, phone: e.contactPhone },
        booking: e.booking,
        quotations: e.quotations.map((q) => ({
          id: q.id, reference: q.reference, version: q.version, status: q.status, currency: q.currency,
          lines: q.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor })),
          subtotalMinor: q.subtotalMinor, discountMinor: q.discountMinor, feesMinor: q.feesMinor, taxMinor: q.taxMinor, totalMinor: q.totalMinor, depositMinor: q.depositMinor,
          validUntil: q.validUntil.toISOString(), terms: q.terms, customerMessage: q.customerMessage,
        })),
      };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/enquiries/:reference/quotations/:quotationId/respond', summary: 'Customer accepts or declines a sent quotation', tags: ['Enquiries'], access: 'public',
    params: z.object({ reference: z.string().trim().toUpperCase(), quotationId: z.string().max(64) }), query: tokenQuery,
    body: z.object({ decision: z.enum(['ACCEPT', 'DECLINE']) }), rateLimit: { max: 10, timeWindow: '10 minutes' },
    handler: async ({ params, query, body, actor, req, ctx }) => {
      const e = await getEnquiryForViewer(params.reference, { actor, accessToken: accessTokenFrom(req.headers, query) });
      if (!e.quotations.some((q) => q.id === params.quotationId)) throw new DomainError('NOT_FOUND', 'Quotation not found.');
      const q = await respondToQuotation(params.quotationId, body.decision, actor, {}, ctx);
      return { status: q.status };
    },
  });

  // --- Contact ---------------------------------------------------------------------
  defineRoute(app, {
    method: 'POST', url: '/api/v1/contact', summary: 'Send a contact message', tags: ['Content'], access: 'public',
    body: contactMessageSchema, status: 201, rateLimit: { max: 5, timeWindow: '10 minutes' },
    handler: async ({ body }) => {
      const msg = await prisma.contactMessage.create({ data: { brand: body.brand, name: body.name, email: body.email, phone: body.phone ?? null, subject: body.subject, message: body.message } });
      const site = await getSetting('siteContent');
      notifySafely({ template: 'contact.received', recipient: body.email, data: { name: body.name, brandName: site[body.brand].name } });
      return { id: msg.id, received: true };
    },
  });
}
