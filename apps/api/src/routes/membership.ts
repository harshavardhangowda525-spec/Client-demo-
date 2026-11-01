import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  cancelMembership,
  confirmMembershipRazorpay,
  listMembershipsAdmin,
  listMyMemberships,
  listPlansAdmin,
  listPublicPlans,
  membershipSummary,
  simulateMembershipPayment,
  startMembershipCheckout,
  syncMembershipPayment,
  upsertPlan,
} from '@studio/core';
import { defineRoute } from '../http/registry';

const idParam = z.object({ id: z.string().min(1).max(64) });
const anyBody = z.record(z.string(), z.unknown());

/** Shape the website needs after a purchase step. */
const purchaseDto = (m: { id: string; status: string; startsAt: Date | null; endsAt: Date | null; plan: { name: string; key: string } }) => ({
  id: m.id,
  status: m.status,
  planName: m.plan.name,
  planKey: m.plan.key,
  startsAt: m.startsAt?.toISOString() ?? null,
  endsAt: m.endsAt?.toISOString() ?? null,
});

export function registerMembershipRoutes(app: FastifyInstance) {
  defineRoute(app, {
    method: 'GET', url: '/api/v1/membership/plans', summary: 'Membership plans on sale (prices from the database)', tags: ['Membership'], access: 'public',
    handler: () => listPublicPlans(),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/me/membership', summary: "The signed-in user's active membership (null when none)", tags: ['Membership'], access: 'public',
    handler: async ({ actor }) => ({ membership: actor && !actor.isStaff ? await membershipSummary(actor.userId) : null }),
  });

  defineRoute(app, {
    method: 'GET', url: '/api/v1/me/memberships', summary: 'Membership purchase history', tags: ['Membership'], access: 'customer',
    handler: ({ actor }) => listMyMemberships(actor!.userId),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/membership/checkout', summary: 'Start buying a plan (activates only after payment is verified)', tags: ['Membership'], access: 'customer',
    body: z.object({ planKey: z.string().min(1).max(40) }), rateLimit: { max: 10, timeWindow: '10 minutes' },
    handler: ({ body, actor, ctx }) => startMembershipCheckout(body.planKey, actor, ctx),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/membership/:id/simulate', summary: 'Demo mode only: complete or fail a simulated membership payment', tags: ['Membership'], access: 'customer',
    params: idParam, body: z.object({ outcome: z.enum(['success', 'failure']) }),
    handler: async ({ params, body, actor, ctx }) => purchaseDto(await simulateMembershipPayment(params.id, body.outcome, actor, ctx)),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/membership/:id/razorpay/confirm', summary: 'Razorpay checkout callback (signature and payment verified server-side)', tags: ['Membership'], access: 'customer',
    params: idParam, body: z.object({ razorpay_order_id: z.string().max(100), razorpay_payment_id: z.string().max(100), razorpay_signature: z.string().max(200) }),
    handler: async ({ params, body, actor, ctx }) => purchaseDto(await confirmMembershipRazorpay(params.id, body, actor, ctx)),
  });

  defineRoute(app, {
    method: 'POST', url: '/api/v1/membership/:id/sync', summary: 'Check with Razorpay whether a membership checkout was paid', tags: ['Membership'], access: 'customer',
    params: idParam, rateLimit: { max: 20, timeWindow: '10 minutes' },
    handler: async ({ params, actor, ctx }) => purchaseDto(await syncMembershipPayment(params.id, actor, ctx)),
  });

  // --- Admin ---------------------------------------------------------------------------
  defineRoute(app, { method: 'GET', url: '/api/v1/admin/membership/plans', summary: 'Membership plans with active member counts', tags: ['Admin: membership'], access: 'catalog.read', handler: () => listPlansAdmin() });
  defineRoute(app, { method: 'POST', url: '/api/v1/admin/membership/plans', summary: 'Create a membership plan', tags: ['Admin: membership'], access: 'catalog.manage', body: anyBody, status: 201, handler: ({ body, actor, ctx }) => upsertPlan(null, body, actor!, ctx) });
  defineRoute(app, { method: 'PUT', url: '/api/v1/admin/membership/plans/:id', summary: 'Update a membership plan (price, discount, perks)', tags: ['Admin: membership'], access: 'catalog.manage', params: idParam, body: anyBody, handler: ({ params, body, actor, ctx }) => upsertPlan(params.id, body, actor!, ctx) });
  defineRoute(app, { method: 'GET', url: '/api/v1/admin/memberships', summary: 'Recent memberships', tags: ['Admin: membership'], access: 'customers.read', handler: () => listMembershipsAdmin() });
  defineRoute(app, { method: 'POST', url: '/api/v1/admin/memberships/:id/cancel', summary: 'End a membership now (no refund issued)', tags: ['Admin: membership'], access: 'bookings.manage', params: idParam, handler: async ({ params, actor, ctx }) => ({ id: (await cancelMembership(params.id, actor!, ctx)).id }) });
}
