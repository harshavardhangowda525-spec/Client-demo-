import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma, type Db, type Membership, type MembershipPlan, type PrismaClient } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, forbidden, invalid, notFound } from '../errors';
import { getEnv } from '../env';
import { getAllSettings, getSetting, siteContentFor } from '../settings';
import { TX_OPTIONS, type Tx } from '../booking/service';
import { activePaymentProvider } from '../payments/service';
import { createRazorpayOrder, fetchRazorpayOrderPayments, fetchRazorpayPayment, razorpayTestMode, verifyCheckoutSignature } from '../payments/razorpay';

const DAY_MS = 86_400_000;
const text = (max: number) => z.string().trim().max(max);

// --- Reading ------------------------------------------------------------------------

export function publicPlanDto(p: MembershipPlan) {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    tagline: p.tagline,
    priceMinor: p.priceMinor,
    periodDays: p.periodDays,
    bookingDiscountBps: p.bookingDiscountBps,
    perks: p.perks,
    isFeatured: p.isFeatured,
    isSample: p.isSample,
  };
}

export async function listPublicPlans(db: Db = prisma) {
  const rows = await db.membershipPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { priceMinor: 'asc' }] });
  return rows.map(publicPlanDto);
}

/** The user's current membership, if one is active right now. */
export async function getActiveMembership(userId: string, db: Db = prisma, now = new Date()) {
  return db.membership.findFirst({
    where: { userId, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
    include: { plan: true },
  });
}

/** What the website needs to show a member: plan, renewal date and booking discount. */
export async function membershipSummary(userId: string, db: Db = prisma, now = new Date()) {
  const m = await getActiveMembership(userId, db, now);
  if (!m) return null;
  return {
    id: m.id,
    plan: publicPlanDto(m.plan),
    startsAt: m.startsAt!.toISOString(),
    endsAt: m.endsAt!.toISOString(),
    bookingDiscountBps: m.plan.bookingDiscountBps,
    isSimulated: m.isSimulated,
  };
}

/** Booking discount for a signed-in member. */
export async function memberDiscountFor(userId: string | null | undefined, db: Db = prisma, now = new Date()) {
  if (!userId) return null;
  const m = await getActiveMembership(userId, db, now);
  if (!m || m.plan.bookingDiscountBps <= 0) return null;
  return { bps: m.plan.bookingDiscountBps, planName: m.plan.name };
}

export async function listMyMemberships(userId: string, db: Db = prisma) {
  const rows = await db.membership.findMany({ where: { userId, status: { in: ['ACTIVE', 'EXPIRED', 'CANCELLED'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 20 });
  return rows.map((m) => ({ id: m.id, planName: m.plan.name, status: m.status, amountMinor: m.amountMinor, currency: m.currency, isSimulated: m.isSimulated, startsAt: m.startsAt?.toISOString() ?? null, endsAt: m.endsAt?.toISOString() ?? null }));
}

// --- Buying -------------------------------------------------------------------------

export type MembershipCheckout =
  | { provider: 'DEMO'; isSimulated: true; membershipId: string; amountMinor: number; currency: string }
  | {
      provider: 'RAZORPAY';
      isSimulated: boolean;
      membershipId: string;
      providerOrderId: string;
      keyId: string;
      amountMinor: number;
      currency: string;
      merchantName: string;
      description: string;
      prefill: { name: string; email: string };
    };

function requireCustomer(actor: Actor | null): Actor {
  if (!actor) throw new DomainError('UNAUTHENTICATED', 'Please sign in to buy a membership.');
  if (actor.isStaff) throw forbidden('Staff accounts cannot buy memberships. Use a customer account.');
  return actor;
}

/** Start buying a plan. The price always comes from the database, never from the browser. */
export async function startMembershipCheckout(planKey: string, actor: Actor | null, ctx: RequestContext = {}, db: PrismaClient = prisma): Promise<MembershipCheckout> {
  const user = requireCustomer(actor);
  const plan = await db.membershipPlan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.isActive) throw notFound('Membership plan');
  const provider = activePaymentProvider();
  if (!provider) throw new DomainError('INTEGRATION_NOT_CONFIGURED', 'Online payment is not available yet, so memberships cannot be bought right now.');
  const regional = await getSetting('regional', db);

  let membership = await db.membership.create({
    data: {
      userId: user.userId,
      planId: plan.id,
      status: 'PENDING_PAYMENT',
      amountMinor: plan.priceMinor,
      currency: regional.currency,
      provider,
      isSimulated: provider === 'DEMO' || razorpayTestMode(),
    },
  });
  await recordAudit(user, { action: 'membership.checkout_started', entityType: 'Membership', entityId: membership.id, summary: `${plan.name} checkout (${provider})`, after: { amountMinor: plan.priceMinor } }, ctx, db);

  if (provider === 'DEMO') {
    return { provider: 'DEMO', isSimulated: true, membershipId: membership.id, amountMinor: membership.amountMinor, currency: membership.currency };
  }
  try {
    const rp = await createRazorpayOrder(
      { amountMinor: membership.amountMinor, currency: membership.currency, receipt: `MEM-${membership.id.slice(-10)}`, notes: { membershipId: membership.id, plan: plan.key } },
      `mem_${membership.id}`,
    );
    membership = await db.membership.update({ where: { id: membership.id }, data: { providerOrderId: rp.id } });
  } catch (err) {
    await db.membership.update({ where: { id: membership.id }, data: { status: 'FAILED', failureReason: (err as Error).message.slice(0, 300) } });
    throw err;
  }
  const settings = await getAllSettings();
  return {
    provider: 'RAZORPAY',
    isSimulated: membership.isSimulated,
    membershipId: membership.id,
    providerOrderId: membership.providerOrderId!,
    keyId: getEnv().RAZORPAY_KEY_ID!,
    amountMinor: membership.amountMinor,
    currency: membership.currency,
    merchantName: siteContentFor(settings, 'STUDIO').name,
    description: `${plan.name} membership`,
    prefill: { name: user.name, email: user.email },
  };
}

async function ownMembership(id: string, actor: Actor | null, db: Db) {
  const user = requireCustomer(actor);
  const m = await db.membership.findUnique({ where: { id }, include: { plan: true } });
  if (!m || m.userId !== user.userId) throw notFound('Membership');
  return { user, membership: m };
}

/**
 * Turn a paid membership on. Buying the plan you already have extends it;
 * buying a different plan replaces the current one from today.
 */
async function activate(membershipId: string, providerPaymentId: string, amountMinor: number, currency: string, db: PrismaClient, now: Date) {
  const result = await db.$transaction(async (tx: Tx) => {
    const m = await tx.membership.findUniqueOrThrow({ where: { id: membershipId }, include: { plan: true } });
    // One purchase at a time per user, so two payments can't both become active.
    await tx.$executeRaw`SELECT 1 FROM "user" WHERE id = ${m.userId} FOR UPDATE`;
    const fresh = await tx.membership.findUniqueOrThrow({ where: { id: membershipId }, include: { plan: true } });
    if (fresh.status === 'ACTIVE') return { membership: fresh, duplicate: true, mismatch: false };
    if (fresh.status !== 'PENDING_PAYMENT') throw new DomainError('INVALID_TRANSITION', 'This membership purchase can no longer be completed.');
    if (amountMinor !== fresh.amountMinor || currency !== fresh.currency) {
      // Saved (not thrown) so the failure is kept; the caller reports it.
      const failed = await tx.membership.update({ where: { id: fresh.id }, data: { status: 'FAILED', failureReason: `Amount mismatch: expected ${fresh.amountMinor} ${fresh.currency}, provider reported ${amountMinor} ${currency}.` }, include: { plan: true } });
      return { membership: failed, duplicate: false, mismatch: true };
    }
    const current = await tx.membership.findFirst({ where: { userId: fresh.userId, status: 'ACTIVE' } });
    // Renewing the same plan adds a period to the time already left on it.
    let periodFrom = now;
    if (current) {
      const stillRunning = !!current.endsAt && current.endsAt > now;
      if (stillRunning && current.planId === fresh.planId) periodFrom = current.endsAt!;
      await tx.membership.update({ where: { id: current.id }, data: stillRunning ? { status: 'CANCELLED', endsAt: now } : { status: 'EXPIRED' } });
    }
    const activated = await tx.membership.update({
      where: { id: fresh.id },
      data: { status: 'ACTIVE', startsAt: now, endsAt: new Date(periodFrom.getTime() + fresh.plan.periodDays * DAY_MS), providerPaymentId, failureReason: null },
      include: { plan: true },
    });
    return { membership: activated, duplicate: false, mismatch: false };
  }, TX_OPTIONS);
  if (result.mismatch) throw new DomainError('PAYMENT_ERROR', 'The payment amount did not match the plan price. No membership was activated.');
  return result;
}

/** Demo mode only: complete or fail a simulated membership payment. */
export async function simulateMembershipPayment(id: string, outcome: 'success' | 'failure', actor: Actor | null, ctx: RequestContext = {}, db: PrismaClient = prisma, now = new Date()) {
  if (getEnv().PAYMENTS_MODE !== 'demo') throw forbidden('Simulated payments are disabled.');
  const { user, membership } = await ownMembership(id, actor, db);
  if (membership.provider !== 'DEMO') throw notFound('Membership');
  if (outcome === 'failure') {
    if (membership.status !== 'PENDING_PAYMENT') throw new DomainError('INVALID_TRANSITION', 'This membership purchase can no longer be changed.');
    await db.membership.update({ where: { id }, data: { status: 'FAILED', failureReason: 'Simulated card decline (demo)' } });
    throw new DomainError('PAYMENT_ERROR', 'Payment failed (simulated). No membership was activated.');
  }
  const result = await activate(id, `demo_mem_${randomBytes(8).toString('hex')}`, membership.amountMinor, membership.currency, db, now);
  if (!result.duplicate) await recordAudit(user, { action: 'membership.activated', entityType: 'Membership', entityId: id, summary: `${membership.plan.name} activated (simulated payment)` }, ctx, db);
  return result.membership;
}

/** Razorpay checkout callback: signature verified, then the payment is fetched from Razorpay. */
export async function confirmMembershipRazorpay(
  id: string,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  actor: Actor | null,
  ctx: RequestContext = {},
  db: PrismaClient = prisma,
  now = new Date(),
) {
  const env = getEnv();
  const { user, membership } = await ownMembership(id, actor, db);
  if (membership.provider !== 'RAZORPAY' || !membership.providerOrderId) throw notFound('Membership');
  if (payload.razorpay_order_id !== membership.providerOrderId) throw invalid('Payment does not match this membership.');
  if (!env.RAZORPAY_KEY_SECRET || !verifyCheckoutSignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature, env.RAZORPAY_KEY_SECRET)) {
    throw new DomainError('PAYMENT_ERROR', 'Payment signature could not be verified.');
  }
  const payment = await fetchRazorpayPayment(payload.razorpay_payment_id);
  if (payment.order_id !== membership.providerOrderId) throw new DomainError('PAYMENT_ERROR', 'Payment does not belong to this membership.');
  if (payment.status !== 'captured') {
    throw new DomainError('PAYMENT_ERROR', payment.status === 'failed' ? (payment.error_description ?? 'Payment failed.') : 'Payment is still processing. Check again in a moment.');
  }
  const result = await activate(id, payment.id, payment.amount, payment.currency, db, now);
  if (!result.duplicate) await recordAudit(user, { action: 'membership.activated', entityType: 'Membership', entityId: id, summary: `${membership.plan.name} activated (Razorpay${membership.isSimulated ? ' test mode' : ''})` }, ctx, db);
  return result.membership;
}

/** For a checkout whose browser never came back: ask Razorpay whether it was paid. */
export async function syncMembershipPayment(id: string, actor: Actor | null, ctx: RequestContext = {}, db: PrismaClient = prisma, now = new Date()) {
  const { user, membership } = await ownMembership(id, actor, db);
  if (membership.status === 'ACTIVE') return membership;
  if (membership.provider !== 'RAZORPAY' || !membership.providerOrderId || membership.status !== 'PENDING_PAYMENT') return membership;
  const captured = (await fetchRazorpayOrderPayments(membership.providerOrderId)).find((p) => p.status === 'captured' && p.order_id === membership.providerOrderId);
  if (!captured) return membership;
  const result = await activate(id, captured.id, captured.amount, captured.currency, db, now);
  if (!result.duplicate) await recordAudit(user, { action: 'membership.activated', entityType: 'Membership', entityId: id, summary: `${membership.plan.name} activated (Razorpay status check)` }, ctx, db);
  return result.membership;
}

// --- Admin --------------------------------------------------------------------------

export const membershipPlanInputSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/, 'Use 2–30 lowercase letters, numbers or dashes, e.g. pro'),
  name: text(60).min(2),
  tagline: text(160).optional().nullable(),
  priceMinor: z.coerce.number().int().min(0).max(100_000_000),
  periodDays: z.coerce.number().int().min(1).max(3660).default(30),
  bookingDiscountBps: z.coerce.number().int().min(0).max(10_000).default(5000),
  perks: z.array(text(160).min(1)).max(12).default([]),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isSample: z.boolean().default(false),
});

export async function listPlansAdmin(db: Db = prisma, now = new Date()) {
  const plans = await db.membershipPlan.findMany({ orderBy: [{ sortOrder: 'asc' }, { priceMinor: 'asc' }] });
  const active = await db.membership.groupBy({ by: ['planId'], where: { status: 'ACTIVE', endsAt: { gt: now } }, _count: { _all: true } });
  return plans.map((p) => ({ ...p, activeMembers: active.find((a) => a.planId === p.id)?._count._all ?? 0 }));
}

export async function upsertPlan(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma) {
  const data = membershipPlanInputSchema.parse(raw);
  if (id && !(await db.membershipPlan.findUnique({ where: { id } }))) throw notFound('Membership plan');
  const clash = await db.membershipPlan.findUnique({ where: { key: data.key } });
  if (clash && clash.id !== id) throw invalid(`The key "${data.key}" is already used by another plan.`);
  const plan = id ? await db.membershipPlan.update({ where: { id }, data }) : await db.membershipPlan.create({ data });
  await recordAudit(actor, { action: id ? 'membership_plan.updated' : 'membership_plan.created', entityType: 'MembershipPlan', entityId: plan.id, summary: `${plan.name}: ${plan.priceMinor / 100} per ${plan.periodDays} days`, after: data }, ctx, db);
  return plan;
}

export async function listMembershipsAdmin(db: Db = prisma, now = new Date()) {
  const rows = await db.membership.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRED', 'CANCELLED'] } },
    include: { plan: { select: { name: true } }, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((m) => ({
    id: m.id,
    planName: m.plan.name,
    customerName: m.user.name,
    customerEmail: m.user.email,
    status: m.status === 'ACTIVE' && m.endsAt && m.endsAt <= now ? 'EXPIRED' : m.status,
    amountMinor: m.amountMinor,
    currency: m.currency,
    provider: m.provider,
    isSimulated: m.isSimulated,
    startsAt: m.startsAt?.toISOString() ?? null,
    endsAt: m.endsAt?.toISOString() ?? null,
  }));
}

/** Admin: end a membership now (e.g. to reset a demo account). No refund is issued. */
export async function cancelMembership(id: string, actor: Actor, ctx: RequestContext = {}, db: PrismaClient = prisma, now = new Date()): Promise<Membership> {
  const m = await db.membership.findUnique({ where: { id }, include: { plan: true } });
  if (!m) throw notFound('Membership');
  if (m.status !== 'ACTIVE') throw new DomainError('INVALID_TRANSITION', 'Only an active membership can be cancelled.');
  const updated = await db.membership.update({ where: { id }, data: { status: 'CANCELLED', endsAt: m.endsAt && m.endsAt < now ? m.endsAt : now } });
  await recordAudit(actor, { action: 'membership.cancelled', entityType: 'Membership', entityId: id, summary: `${m.plan.name} membership cancelled by staff` }, ctx, db);
  return updated;
}
