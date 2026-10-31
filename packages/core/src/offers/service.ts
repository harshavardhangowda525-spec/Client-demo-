import { z } from 'zod';
import { prisma, type Db, type Offer, type Prisma } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, invalid, notFound } from '../errors';
import { applyBps } from '../money';

/** Booking statuses whose coupon use no longer counts towards limits. */
const RELEASED_STATUSES = ['CANCELLED', 'REJECTED'] as const;

const text = (max: number) => z.string().trim().max(max);

export const offerInputSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Use 3–20 letters or numbers, e.g. FIRST10'),
    title: text(120).min(3),
    description: text(500).optional().nullable(),
    terms: text(2000).optional().nullable(),
    discountType: z.enum(['PERCENT', 'FLAT']),
    /** PERCENT: basis points (1000 = 10%). FLAT: paise. */
    value: z.coerce.number().int().positive(),
    maxDiscountMinor: z.coerce.number().int().positive().optional().nullable(),
    minOrderMinor: z.coerce.number().int().min(0).default(0),
    validFrom: z.coerce.date().optional().nullable(),
    validUntil: z.coerce.date().optional().nullable(),
    usageLimit: z.coerce.number().int().positive().optional().nullable(),
    perCustomerLimit: z.coerce.number().int().positive().optional().nullable(),
    isActive: z.boolean().default(true),
    showOnSite: z.boolean().default(true),
    imageKey: text(120).optional().nullable(),
    serviceIds: z.array(z.string().max(64)).max(100).default([]),
  })
  .refine((o) => o.discountType !== 'PERCENT' || o.value <= 10_000, { message: 'A percentage discount cannot exceed 100%.', path: ['value'] })
  .refine((o) => !o.validFrom || !o.validUntil || o.validUntil > o.validFrom, { message: 'The offer must end after it starts.', path: ['validUntil'] });

export type OfferWithServices = Offer & { services: { serviceId: string }[] };

/** Plain-language summary of the discount, e.g. "10% off (up to ₹500)". */
export function describeDiscount(o: Pick<Offer, 'discountType' | 'value' | 'maxDiscountMinor' | 'minOrderMinor'>): string {
  const rupees = (m: number) => `₹${(m / 100).toLocaleString('en-IN')}`;
  const base = o.discountType === 'PERCENT' ? `${o.value / 100}% off` : `${rupees(o.value)} off`;
  const cap = o.discountType === 'PERCENT' && o.maxDiscountMinor ? ` (up to ${rupees(o.maxDiscountMinor)})` : '';
  const min = o.minOrderMinor > 0 ? ` on orders of ${rupees(o.minOrderMinor)} or more` : '';
  return `${base}${cap}${min}`;
}

/** Discount for a given subtotal (before fees and tax), never more than the subtotal. */
export function discountFor(o: Pick<Offer, 'discountType' | 'value' | 'maxDiscountMinor'>, subtotalMinor: number): number {
  let d = o.discountType === 'PERCENT' ? applyBps(subtotalMinor, o.value) : o.value;
  if (o.maxDiscountMinor) d = Math.min(d, o.maxDiscountMinor);
  return Math.max(0, Math.min(d, subtotalMinor));
}

/**
 * Validate a coupon code for an order. Throws a VALIDATION error with a
 * customer-friendly message when it cannot be used. Per-customer limits are
 * checked only when the customer is known (always at booking time).
 */
export async function evaluateCoupon(
  rawCode: string,
  ctx: { serviceId: string; subtotalMinor: number; customerId?: string | null; excludeBookingId?: string },
  db: Db = prisma,
  now = new Date(),
): Promise<{ offer: OfferWithServices; discountMinor: number }> {
  const code = rawCode.trim().toUpperCase();
  const offer = code ? await db.offer.findUnique({ where: { code }, include: { services: { select: { serviceId: true } } } }) : null;
  const fail = (message: string): never => {
    throw new DomainError('VALIDATION', message, [{ path: 'couponCode', message }]);
  };
  if (!offer || !offer.isActive) return fail('This coupon code is not valid.');
  if (offer.validFrom && offer.validFrom > now) return fail('This offer has not started yet.');
  if (offer.validUntil && offer.validUntil <= now) return fail('This offer has expired.');
  if (offer.services.length && !offer.services.some((s) => s.serviceId === ctx.serviceId)) return fail('This coupon cannot be used for this service.');
  if (ctx.subtotalMinor < offer.minOrderMinor) {
    return fail(`This coupon needs a minimum order of ₹${(offer.minOrderMinor / 100).toLocaleString('en-IN')} before tax and fees.`);
  }
  const counted = { offerId: offer.id, booking: { status: { notIn: [...RELEASED_STATUSES] } }, ...(ctx.excludeBookingId ? { bookingId: { not: ctx.excludeBookingId } } : {}) } satisfies Prisma.OfferRedemptionWhereInput;
  if (offer.usageLimit != null && (await db.offerRedemption.count({ where: counted })) >= offer.usageLimit) {
    return fail('This offer has been fully used.');
  }
  if (ctx.customerId && offer.perCustomerLimit != null) {
    const mine = await db.offerRedemption.count({ where: { ...counted, customerId: ctx.customerId } });
    if (mine >= offer.perCustomerLimit) return fail('You have already used this coupon.');
  }
  const discountMinor = discountFor(offer, ctx.subtotalMinor);
  if (discountMinor <= 0) return fail('This coupon does not reduce the price of this booking.');
  return { offer, discountMinor };
}

/** Serialise concurrent bookings that use the same offer, so limits can't be exceeded. */
export async function lockOffer(tx: Prisma.TransactionClient, offerId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'offer:' + offerId}))`;
}

// --- Public listing ------------------------------------------------------------------
export async function listPublicOffers(db: Db = prisma, now = new Date()) {
  const rows = await db.offer.findMany({
    where: {
      isActive: true,
      showOnSite: true,
      AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }, { OR: [{ validUntil: null }, { validUntil: { gt: now } }] }],
    },
    include: { services: { include: { service: { select: { name: true, slug: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    description: o.description,
    terms: o.terms,
    summary: describeDiscount(o),
    validUntil: o.validUntil?.toISOString() ?? null,
    imageKey: o.imageKey,
    services: o.services.map((s) => s.service),
    isDemo: o.isDemo,
  }));
}

// --- Admin ---------------------------------------------------------------------------
export async function listOffersAdmin(db: Db = prisma) {
  const rows = await db.offer.findMany({ include: { services: { select: { serviceId: true } } }, orderBy: { createdAt: 'desc' } });
  const counts = await db.offerRedemption.groupBy({ by: ['offerId'], where: { booking: { status: { notIn: [...RELEASED_STATUSES] } } }, _count: { _all: true }, _sum: { discountMinor: true } });
  return rows.map((o) => {
    const c = counts.find((x) => x.offerId === o.id);
    return { ...o, serviceIds: o.services.map((s) => s.serviceId), redemptions: c?._count._all ?? 0, discountGivenMinor: c?._sum.discountMinor ?? 0, summary: describeDiscount(o) };
  });
}

export async function upsertOffer(id: string | null, raw: unknown, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const { serviceIds, ...data } = offerInputSchema.parse(raw);
  if (serviceIds.length) {
    const found = await db.service.count({ where: { id: { in: serviceIds } } });
    if (found !== serviceIds.length) throw invalid('One or more selected services no longer exist.');
  }
  if (id && !(await db.offer.findUnique({ where: { id } }))) throw notFound('Offer');
  const clash = await db.offer.findUnique({ where: { code: data.code } });
  if (clash && clash.id !== id) throw invalid(`The code ${data.code} is already used by another offer.`);
  const offer = await db.$transaction(async (tx) => {
    const row = id ? await tx.offer.update({ where: { id }, data }) : await tx.offer.create({ data });
    await tx.offerService.deleteMany({ where: { offerId: row.id } });
    if (serviceIds.length) await tx.offerService.createMany({ data: serviceIds.map((serviceId) => ({ offerId: row.id, serviceId })) });
    return row;
  });
  await recordAudit(actor, { action: id ? 'offer.updated' : 'offer.created', entityType: 'Offer', entityId: offer.id, summary: `${offer.code}: ${describeDiscount(offer)}`, after: { ...data, serviceIds } }, ctx, db);
  return offer;
}
