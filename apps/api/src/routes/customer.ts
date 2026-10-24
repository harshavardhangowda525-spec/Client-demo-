import type { FastifyInstance } from 'fastify';
import { prisma } from '@studio/db';
import { getOwnProfile, PAYMENT_STATUS_LABELS, profileUpdateSchema, recordAudit, STATUS_LABELS, type BookingStatusValue } from '@studio/core';
import { defineRoute } from '../http/registry';

export function registerCustomerRoutes(app: FastifyInstance) {
  defineRoute(app, {
    method: 'GET', url: '/api/v1/me', summary: 'Current user, role, permissions and customer profile', tags: ['Account'], access: 'customer',
    handler: async ({ actor }) => {
      const profile = await getOwnProfile(actor!);
      return {
        user: { id: actor!.userId, name: actor!.name, email: actor!.email, role: actor!.role, isStaff: actor!.isStaff, permissions: [...actor!.permissions] },
        profile: { id: profile.id, fullName: profile.fullName, email: profile.email, phone: profile.phone, company: profile.company, marketingOptIn: profile.marketingOptIn },
      };
    },
  });

  defineRoute(app, {
    method: 'PATCH', url: '/api/v1/me/profile', summary: 'Update own profile', tags: ['Account'], access: 'customer',
    body: profileUpdateSchema,
    handler: async ({ actor, body, ctx }) => {
      const profile = await getOwnProfile(actor!);
      const updated = await prisma.customerProfile.update({
        where: { id: profile.id },
        data: { fullName: body.fullName, phone: body.phone ?? null, company: body.company ?? null, marketingOptIn: body.marketingOptIn ?? profile.marketingOptIn },
      });
      await prisma.user.update({ where: { id: actor!.userId }, data: { name: body.fullName } });
      await recordAudit(actor!, { action: 'profile.updated', entityType: 'CustomerProfile', entityId: profile.id }, ctx);
      return { id: updated.id, fullName: updated.fullName, email: updated.email, phone: updated.phone, company: updated.company, marketingOptIn: updated.marketingOptIn };
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/me/bookings', summary: "Own booking history (all three websites)", tags: ['Account'], access: 'customer',
    handler: async ({ actor }) => {
      const profile = await getOwnProfile(actor!);
      const rows = await prisma.booking.findMany({
        where: { customerId: profile.id },
        include: { service: { select: { name: true } }, location: { select: { name: true } } },
        orderBy: { startsAt: 'desc' },
        take: 200,
      });
      return rows.map((b) => ({
        reference: b.reference,
        brand: b.brand,
        service: b.service.name,
        location: b.location.name,
        startsAt: b.startsAt.toISOString(),
        timezone: b.timezone,
        status: b.status,
        statusLabel: STATUS_LABELS[b.status as BookingStatusValue],
        paymentStatus: b.paymentStatus,
        paymentStatusLabel: PAYMENT_STATUS_LABELS[b.paymentStatus],
        totalMinor: b.totalMinor,
        amountPaidMinor: b.amountPaidMinor,
        currency: b.currency,
        isDemo: b.isDemo,
      }));
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/me/enquiries', summary: 'Own event enquiries', tags: ['Account'], access: 'customer',
    handler: async ({ actor }) => {
      const profile = await getOwnProfile(actor!);
      const rows = await prisma.eventEnquiry.findMany({ where: { customerId: profile.id }, orderBy: { createdAt: 'desc' }, take: 100 });
      return rows.map((e) => ({ reference: e.reference, eventType: e.eventType, preferredDate: e.preferredDate.toISOString().slice(0, 10), status: e.status, expectedAttendance: e.expectedAttendance, createdAt: e.createdAt.toISOString() }));
    },
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/me/payments', summary: 'Own payment history', tags: ['Account'], access: 'customer',
    handler: async ({ actor }) => {
      const profile = await getOwnProfile(actor!);
      const rows = await prisma.transaction.findMany({
        where: { booking: { customerId: profile.id } },
        include: { booking: { select: { reference: true, brand: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.map((t) => ({ bookingReference: t.booking.reference, brand: t.booking.brand, type: t.type, status: t.status, amountMinor: t.amountMinor, currency: t.currency, isSimulated: t.isSimulated, at: t.createdAt.toISOString() }));
    },
  });
}
