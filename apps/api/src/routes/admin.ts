import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@studio/db';
import {
  addBookingNote,
  addFollowUp,
  allowedTransitions,
  completeFollowUp,
  convertQuotationSchema,
  convertQuotationToBooking,
  createBlockedPeriod,
  deleteBlockedPeriod,
  deleteFaq,
  deletePortfolio,
  DomainError,
  getAllSettings,
  getBookingAdmin,
  getCustomerAdmin,
  getDashboard,
  getEnquiryAdmin,
  getIntegrationStatuses,
  issueRefund,
  syncPendingRefunds,
  listAuditLogs,
  listEnquiries,
  listNotifications,
  listPayments,
  minutesToHHMM,
  notifyBookingStatus,
  notifyQuotationSent,
  recordAudit,
  rescheduleBooking,
  respondToQuotation,
  saveQuotationDraft,
  searchBookings,
  searchCustomers,
  sendQuotation,
  setOpeningHours,
  settingSchemas,
  transitionBooking,
  transitionSchema,
  updateEnquiry,
  updateSetting,
  upsertAddOn,
  upsertCategory,
  upsertFaq,
  upsertLocation,
  upsertPackage,
  upsertPortfolio,
  upsertResource,
  upsertService,
  verifyIntegration,
  brandSchema,
  rescheduleSchema,
  type BookingStatusValue,
  type SettingKey,
} from '@studio/core';
import { defineRoute } from '../http/registry';
import imageCatalog from '../../../../assets/demo-images/catalog.json' with { type: 'json' };

const idParam = z.object({ id: z.string().min(1).max(64) });
const pageQuery = z.object({ page: z.coerce.number().int().min(1).optional() });
const anyBody = z.record(z.string(), z.unknown());

export function registerAdminRoutes(app: FastifyInstance) {
  // --- Dashboard -------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/dashboard', summary: 'Summary metrics computed from live records', tags: ['Admin'], access: 'bookings.read',
    handler: () => getDashboard(),
  });

  // --- Bookings --------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/bookings', summary: 'Search and filter bookings', tags: ['Admin: bookings'], access: 'bookings.read',
    query: z.object({
      q: z.string().max(100).optional(),
      brand: brandSchema.optional(),
      status: z.string().max(40).optional(),
      paymentStatus: z.string().max(40).optional(),
      from: z.string().max(40).optional(),
      to: z.string().max(40).optional(),
      locationId: z.string().max(64).optional(),
      page: z.coerce.number().int().min(1).optional(),
    }),
    handler: ({ query }) => searchBookings({ ...query, status: query.status as never }),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/bookings/:id', summary: 'Full booking detail incl. history, notes, payments', tags: ['Admin: bookings'], access: 'bookings.read',
    params: idParam,
    handler: async ({ params }) => {
      const b = await getBookingAdmin(params.id);
      if (!b) throw new DomainError('NOT_FOUND', 'Booking not found.');
      const { accessTokenHash: _omit, ...rest } = b;
      return { ...rest, allowedTransitions: allowedTransitions(b.status as BookingStatusValue, 'STAFF') };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/bookings/:id/transition', summary: 'Approve, reject, confirm, cancel or progress a booking', tags: ['Admin: bookings'], access: 'bookings.manage',
    params: idParam, body: transitionSchema,
    handler: async ({ params, body, actor, ctx }) => {
      const updated = await transitionBooking({ bookingId: params.id, to: body.to, actorType: 'STAFF', actor, reason: body.reason }, prisma, ctx);
      await notifyBookingStatus(updated, body.reason);
      return updated;
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/bookings/:id/reschedule', summary: 'Reschedule (availability is re-checked)', tags: ['Admin: bookings'], access: 'bookings.manage',
    params: idParam, body: rescheduleSchema,
    handler: async ({ params, body, actor, ctx }) => {
      const updated = await rescheduleBooking(params.id, body, actor!, ctx);
      await notifyBookingStatus(updated, `Your booking has been rescheduled. ${body.reason}`);
      return updated;
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/bookings/:id/notes', summary: 'Add an internal note', tags: ['Admin: bookings'], access: 'bookings.manage',
    params: idParam, body: z.object({ body: z.string().min(1).max(4000) }), status: 201,
    handler: ({ params, body, actor, ctx }) => addBookingNote(params.id, body.body, actor!, ctx),
  });

  // --- Catalogue -------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/catalog', summary: 'All services (incl. inactive), packages, add-ons and categories', tags: ['Admin: catalogue'], access: 'catalog.read',
    query: z.object({ brand: brandSchema.optional() }),
    handler: async ({ query }) => {
      const where = query.brand ? { brand: query.brand } : {};
      const [services, addOns, categories] = await Promise.all([
        prisma.service.findMany({
          where,
          include: { category: true, packages: { orderBy: { sortOrder: 'asc' } }, locations: true, resources: true, addOns: true, discoveryCategories: true, equipment: true, _count: { select: { bookings: true } } },
          orderBy: [{ brand: 'asc' }, { sortOrder: 'asc' }],
        }),
        prisma.addOn.findMany({ where, orderBy: [{ brand: 'asc' }, { name: 'asc' }] }),
        prisma.category.findMany({ where, orderBy: [{ brand: 'asc' }, { sortOrder: 'asc' }] }),
      ]);
      return {
        services: services.map((s) => ({ ...s, locationIds: s.locations.map((l) => l.locationId), resourceIds: s.resources.map((r) => r.resourceId), addOnIds: s.addOns.map((a) => a.addOnId), discoveryCategoryIds: s.discoveryCategories.map((c) => c.categoryId), equipmentIds: s.equipment.map((e) => e.equipmentId) })),
        addOns,
        categories,
      };
    },
  });

  for (const [path, fn, label] of [
    ['services', upsertService, 'service'],
    ['packages', upsertPackage, 'package'],
    ['addons', upsertAddOn, 'add-on'],
    ['categories', upsertCategory, 'category'],
  ] as const) {
    defineRoute(app, {
      method: 'POST', url: `/api/v1/admin/${path}`, summary: `Create a ${label}`, tags: ['Admin: catalogue'], access: 'catalog.manage', body: anyBody, status: 201,
      handler: ({ body, actor, ctx }) => fn(null, body, actor!, ctx),
    });
    defineRoute(app, {
      method: 'PUT', url: `/api/v1/admin/${path}/:id`, summary: `Update a ${label}`, tags: ['Admin: catalogue'], access: 'catalog.manage', params: idParam, body: anyBody,
      handler: ({ params, body, actor, ctx }) => fn(params.id, body, actor!, ctx),
    });
  }

  // --- Locations, resources, schedules --------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/locations', summary: 'Locations with resources, opening hours and upcoming blocks', tags: ['Admin: locations'], access: 'catalog.read',
    handler: async () => {
      const rows = await prisma.location.findMany({
        include: {
          resources: { orderBy: { name: 'asc' }, include: { openingHours: true } },
          openingHours: { where: { resourceId: null }, orderBy: [{ dayOfWeek: 'asc' }, { openMinute: 'asc' }] },
          blocks: { where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, include: { resource: { select: { name: true } } } },
        },
        orderBy: { name: 'asc' },
      });
      const resourceBlocks = await prisma.blockedPeriod.findMany({ where: { resourceId: { not: null }, locationId: null, endsAt: { gte: new Date() } }, include: { resource: true } });
      return rows.map((l) => ({
        ...l,
        openingHours: l.openingHours.map((h) => ({ ...h, open: minutesToHHMM(h.openMinute), close: minutesToHHMM(h.closeMinute) })),
        resources: l.resources.map((r) => ({ ...r, openingHours: r.openingHours.map((h) => ({ ...h, open: minutesToHHMM(h.openMinute), close: minutesToHHMM(h.closeMinute) })) })),
        blocks: [...l.blocks, ...resourceBlocks.filter((b) => b.resource?.locationId === l.id)].sort((a, b) => +a.startsAt - +b.startsAt),
      }));
    },
  });

  for (const [path, fn, label] of [
    ['locations', upsertLocation, 'location'],
    ['resources', upsertResource, 'resource'],
  ] as const) {
    defineRoute(app, {
      method: 'POST', url: `/api/v1/admin/${path}`, summary: `Create a ${label}`, tags: ['Admin: locations'], access: 'locations.manage', body: anyBody, status: 201,
      handler: ({ body, actor, ctx }) => fn(null, body, actor!, ctx),
    });
    defineRoute(app, {
      method: 'PUT', url: `/api/v1/admin/${path}/:id`, summary: `Update a ${label}`, tags: ['Admin: locations'], access: 'locations.manage', params: idParam, body: anyBody,
      handler: ({ params, body, actor, ctx }) => fn(params.id, body, actor!, ctx),
    });
  }

  defineRoute(app, {
    method: 'PUT', url: '/api/v1/admin/opening-hours', summary: 'Replace weekly opening hours for a location or resource', tags: ['Admin: locations'], access: 'locations.manage', body: anyBody,
    handler: async ({ body, actor, ctx }) => {
      await setOpeningHours(body, actor!, ctx);
      return { ok: true };
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/blocked-periods', summary: 'Add a closure or maintenance block (returns overlapping bookings)', tags: ['Admin: locations'], access: 'locations.manage', body: anyBody, status: 201,
    handler: ({ body, actor, ctx }) => createBlockedPeriod(body, actor!, ctx),
  });

  defineRoute(app, {
    method: 'DELETE', url: '/api/v1/admin/blocked-periods/:id', summary: 'Remove a block', tags: ['Admin: locations'], access: 'locations.manage', params: idParam,
    handler: async ({ params, actor, ctx }) => {
      await deleteBlockedPeriod(params.id, actor!, ctx);
      return { ok: true };
    },
  });

  // --- Customers -------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/customers', summary: 'Search customers', tags: ['Admin: customers'], access: 'customers.read',
    query: z.object({ q: z.string().max(100).optional(), page: z.coerce.number().int().min(1).optional() }),
    handler: ({ query }) => searchCustomers(query.q, query.page),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/customers/:id', summary: 'Customer profile with booking and enquiry history', tags: ['Admin: customers'], access: 'customers.read', params: idParam,
    handler: async ({ params, actor, ctx }) => {
      const c = await getCustomerAdmin(params.id);
      if (!c) throw new DomainError('NOT_FOUND', 'Customer not found.');
      await recordAudit(actor!, { action: 'customer.viewed', entityType: 'CustomerProfile', entityId: c.id }, ctx);
      return c;
    },
  });

  // --- Enquiries & quotations ------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/enquiries', summary: 'List enquiries', tags: ['Admin: enquiries'], access: 'enquiries.read',
    query: z.object({ status: z.string().max(40).optional(), q: z.string().max(100).optional(), page: z.coerce.number().int().min(1).optional() }),
    handler: ({ query }) => listEnquiries(query),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/enquiries/:id', summary: 'Enquiry detail with quotations and follow-ups', tags: ['Admin: enquiries'], access: 'enquiries.read', params: idParam,
    handler: async ({ params }) => {
      const e = await getEnquiryAdmin(params.id);
      if (!e) throw new DomainError('NOT_FOUND', 'Enquiry not found.');
      const { accessTokenHash: _omit, ...rest } = e;
      return rest;
    },
  });

  defineRoute(app, {
    method: 'PATCH', url: '/api/v1/admin/enquiries/:id', summary: 'Update enquiry status, assignee or next follow-up', tags: ['Admin: enquiries'], access: 'enquiries.manage', params: idParam,
    body: z.object({
      status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'DECLINED', 'CONVERTED', 'CLOSED']).optional(),
      assignedToId: z.string().max(64).nullable().optional(),
      nextFollowUpAt: z.string().max(40).nullable().optional(),
    }),
    handler: ({ params, body, actor, ctx }) => updateEnquiry(params.id, body, actor!, ctx),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/enquiries/:id/follow-ups', summary: 'Add a follow-up note or task', tags: ['Admin: enquiries'], access: 'enquiries.manage', params: idParam, status: 201,
    body: z.object({ note: z.string().min(1).max(4000), dueAt: z.string().max(40).nullable().optional() }),
    handler: ({ params, body, actor }) => addFollowUp(params.id, body.note, body.dueAt, actor!),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/follow-ups/:id/complete', summary: 'Mark a follow-up complete', tags: ['Admin: enquiries'], access: 'enquiries.manage', params: idParam,
    handler: ({ params, actor }) => completeFollowUp(params.id, actor!),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/enquiries/:id/quotations', summary: 'Create or update the draft quotation (server computes totals)', tags: ['Admin: enquiries'], access: 'enquiries.manage', params: idParam, body: anyBody,
    handler: ({ params, body, actor, ctx }) => saveQuotationDraft(params.id, body, actor!, ctx),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/quotations/:id/send', summary: 'Send a draft quotation to the customer', tags: ['Admin: enquiries'], access: 'enquiries.manage', params: idParam,
    handler: async ({ params, actor, ctx }) => {
      const { quotation, enquiry } = await sendQuotation(params.id, actor!, ctx);
      await notifyQuotationSent(quotation, enquiry);
      return quotation;
    },
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/quotations/:id/respond', summary: "Record the customer's acceptance/decline (requires a note)", tags: ['Admin: enquiries'], access: 'enquiries.manage', params: idParam,
    body: z.object({ decision: z.enum(['ACCEPT', 'DECLINE']), reason: z.string().min(3).max(500) }),
    handler: ({ params, body, actor, ctx }) => respondToQuotation(params.id, body.decision, actor, { onBehalf: true, reason: body.reason }, ctx),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/quotations/:id/convert', summary: 'Convert an accepted quotation into a booking (availability verified)', tags: ['Admin: enquiries'], access: 'bookings.manage', params: idParam,
    body: convertQuotationSchema, status: 201,
    handler: async ({ params, body, actor, ctx }) => {
      const { booking } = await convertQuotationToBooking(params.id, body, actor!, ctx);
      await notifyBookingStatus(booking, 'Your event booking has been created from the accepted proposal.');
      return booking;
    },
  });

  // --- Payments --------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/payments', summary: 'Transactions, failed orders and refunds (real and simulated kept distinct)', tags: ['Admin: payments'], access: 'payments.read',
    query: z.object({ simulated: z.enum(['true', 'false']).optional(), status: z.string().max(20).optional(), page: z.coerce.number().int().min(1).optional() }),
    handler: ({ query }) => listPayments(query),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/transactions/:id/refund', summary: 'Refund all or part of a successful charge', tags: ['Admin: payments'], access: 'payments.refund', params: idParam,
    body: z.object({ amountMinor: z.coerce.number().int().positive(), reason: z.string().min(3).max(500) }),
    handler: ({ params, body, actor, ctx }) => issueRefund(params.id, body.amountMinor, body.reason, actor!, ctx),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/refunds/sync', summary: 'Check pending Razorpay refunds with the provider and complete those it has processed', tags: ['Admin: payments'], access: 'payments.read',
    handler: () => syncPendingRefunds(),
  });

  // --- Settings & integrations -----------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/settings', summary: 'Business configuration', tags: ['Admin: settings'], access: 'settings.read',
    handler: () => getAllSettings(),
  });

  defineRoute(app, {
    method: 'PUT', url: '/api/v1/admin/settings/:key', summary: 'Update one configuration group (validated)', tags: ['Admin: settings'], access: 'settings.manage',
    params: z.object({ key: z.enum(Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]]) }), body: anyBody,
    handler: async ({ params, body, actor, ctx }) => {
      const before = await getAllSettings();
      const value = await updateSetting(params.key, body, actor!.userId);
      await recordAudit(actor!, { action: 'settings.updated', entityType: 'Setting', entityId: params.key, before: before[params.key], after: value }, ctx);
      return value;
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/integrations', summary: 'Integration states (never reports success without verification)', tags: ['Admin: settings'], access: 'settings.read',
    handler: () => getIntegrationStatuses(),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/integrations/:key/verify', summary: 'Run a live credential check against the provider', tags: ['Admin: settings'], access: 'settings.manage',
    params: z.object({ key: z.string().max(60) }),
    handler: async ({ params, actor, ctx }) => {
      try {
        const status = await verifyIntegration(params.key);
        await recordAudit(actor!, { action: 'integration.verified', entityType: 'Integration', entityId: params.key, after: { state: status.state } }, ctx);
        return status;
      } catch (err) {
        throw new DomainError('VALIDATION', (err as Error).message);
      }
    },
  });

  // --- Audit & notifications -------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/audit', summary: 'Audit log', tags: ['Admin: audit'], access: 'audit.read',
    query: z.object({ entityType: z.string().max(60).optional(), entityId: z.string().max(64).optional(), actorUserId: z.string().max(64).optional(), page: z.coerce.number().int().min(1).optional() }),
    handler: ({ query }) => listAuditLogs(query),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/notifications', summary: 'Notification records (bodies visible only in development preview mode)', tags: ['Admin: audit'], access: 'notifications.read',
    query: pageQuery,
    handler: ({ query }) => listNotifications(query.page),
  });

  // --- Content ---------------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/portfolio', summary: 'Portfolio and gallery projects (incl. unpublished)', tags: ['Admin: content'], access: 'content.manage',
    query: z.object({ brand: brandSchema.optional() }),
    handler: ({ query }) => prisma.portfolioProject.findMany({ where: query.brand ? { brand: query.brand } : {}, include: { images: { orderBy: { sortOrder: 'asc' } }, category: true }, orderBy: [{ brand: 'asc' }, { sortOrder: 'asc' }] }),
  });
  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/portfolio', summary: 'Create a portfolio project', tags: ['Admin: content'], access: 'content.manage', body: anyBody, status: 201,
    handler: ({ body, actor, ctx }) => upsertPortfolio(null, body, actor!, ctx),
  });
  defineRoute(app, {
    method: 'PUT', url: '/api/v1/admin/portfolio/:id', summary: 'Update a portfolio project', tags: ['Admin: content'], access: 'content.manage', params: idParam, body: anyBody,
    handler: ({ params, body, actor, ctx }) => upsertPortfolio(params.id, body, actor!, ctx),
  });
  defineRoute(app, {
    method: 'DELETE', url: '/api/v1/admin/portfolio/:id', summary: 'Delete a portfolio project', tags: ['Admin: content'], access: 'content.manage', params: idParam,
    handler: async ({ params, actor, ctx }) => {
      await deletePortfolio(params.id, actor!, ctx);
      return { ok: true };
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/faqs', summary: 'All FAQs', tags: ['Admin: content'], access: 'content.manage',
    handler: () => prisma.faq.findMany({ orderBy: [{ brand: 'asc' }, { sortOrder: 'asc' }] }),
  });
  defineRoute(app, {
    method: 'POST', url: '/api/v1/admin/faqs', summary: 'Create an FAQ', tags: ['Admin: content'], access: 'content.manage', body: anyBody, status: 201,
    handler: ({ body, actor, ctx }) => upsertFaq(null, body, actor!, ctx),
  });
  defineRoute(app, {
    method: 'PUT', url: '/api/v1/admin/faqs/:id', summary: 'Update an FAQ', tags: ['Admin: content'], access: 'content.manage', params: idParam, body: anyBody,
    handler: ({ params, body, actor, ctx }) => upsertFaq(params.id, body, actor!, ctx),
  });
  defineRoute(app, {
    method: 'DELETE', url: '/api/v1/admin/faqs/:id', summary: 'Delete an FAQ', tags: ['Admin: content'], access: 'content.manage', params: idParam,
    handler: async ({ params, actor, ctx }) => {
      await deleteFaq(params.id, actor!, ctx);
      return { ok: true };
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/contact-messages', summary: 'Contact form messages', tags: ['Admin: content'], access: 'content.manage',
    query: z.object({ status: z.enum(['NEW', 'IN_PROGRESS', 'CLOSED']).optional() }),
    handler: ({ query }) => prisma.contactMessage.findMany({ where: query.status ? { status: query.status } : {}, orderBy: { createdAt: 'desc' }, take: 200 }),
  });
  defineRoute(app, {
    method: 'PATCH', url: '/api/v1/admin/contact-messages/:id', summary: 'Update contact message status', tags: ['Admin: content'], access: 'content.manage', params: idParam,
    body: z.object({ status: z.enum(['NEW', 'IN_PROGRESS', 'CLOSED']) }),
    handler: async ({ params, body, actor, ctx }) => {
      const row = await prisma.contactMessage.update({ where: { id: params.id }, data: { status: body.status } });
      await recordAudit(actor!, { action: 'contact.status_changed', entityType: 'ContactMessage', entityId: row.id, after: body }, ctx);
      return row;
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/media', summary: 'Available sample image keys', tags: ['Admin: content'], access: 'catalog.read',
    handler: async () => Object.entries(imageCatalog.images).map(([key, v]) => ({ key, alt: v.alt, width: v.w, height: v.h })),
  });

  // --- Staff & roles ---------------------------------------------------------------
  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/staff', summary: 'Staff members (for assignment)', tags: ['Admin: users'], access: 'enquiries.read',
    handler: () => prisma.user.findMany({ where: { roleRef: { isStaff: true }, isActive: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } }),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/admin/users', summary: 'All user accounts with roles', tags: ['Admin: users'], access: 'users.manage',
    query: z.object({ q: z.string().max(100).optional() }),
    handler: async ({ query }) => {
      const [users, roles] = await Promise.all([
        prisma.user.findMany({
          where: query.q ? { OR: [{ email: { contains: query.q, mode: 'insensitive' } }, { name: { contains: query.q, mode: 'insensitive' } }] } : {},
          select: { id: true, name: true, email: true, role: true, isActive: true, emailVerified: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        prisma.role.findMany({ include: { permissions: true } }),
      ]);
      return { users, roles: roles.map((r) => ({ key: r.key, name: r.name, description: r.description, isStaff: r.isStaff, permissions: r.permissions.map((p) => p.permissionKey) })) };
    },
  });

  defineRoute(app, {
    method: 'PATCH', url: '/api/v1/admin/users/:id', summary: 'Change a user role or deactivate an account', tags: ['Admin: users'], access: 'users.manage', params: idParam,
    body: z.object({ role: z.string().max(40).optional(), isActive: z.boolean().optional() }),
    handler: async ({ params, body, actor, ctx }) => {
      if (params.id === actor!.userId) throw new DomainError('FORBIDDEN', 'You cannot change your own role or status.');
      if (body.role && !(await prisma.role.findUnique({ where: { key: body.role } }))) throw new DomainError('VALIDATION', 'Unknown role.');
      const before = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true, isActive: true } });
      if (!before) throw new DomainError('NOT_FOUND', 'User not found.');
      const updated = await prisma.user.update({ where: { id: params.id }, data: body, select: { id: true, role: true, isActive: true } });
      if (body.isActive === false || (body.role && body.role !== before.role)) await prisma.session.deleteMany({ where: { userId: params.id } });
      // Staff sign in with a password only: remove any Google (social) sign-in link on promotion.
      if (body.role && body.role !== 'customer') await prisma.account.deleteMany({ where: { userId: params.id, providerId: { not: 'credential' } } });
      await recordAudit(actor!, { action: 'user.updated', entityType: 'User', entityId: params.id, before, after: body }, ctx);
      return updated;
    },
  });
}
