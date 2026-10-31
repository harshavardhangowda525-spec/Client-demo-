import { z } from 'zod';
import { prisma, type Db } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, notFound } from '../errors';
import { getBookingForViewer, type Viewer } from '../booking/service';

export const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating from 1 to 5 stars').max(5),
  comment: z.string().trim().max(1500).optional().nullable().or(z.literal('').transform(() => null)),
});

/** A review is allowed once the session has actually taken place. */
export function canReview(b: { status: string; endsAt: Date }, now = new Date()) {
  return b.status === 'COMPLETED' || ((b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && b.endsAt <= now);
}

/** Customer review for one of their own bookings (one per booking; editing replaces it). */
export async function submitReview(reference: string, viewer: Viewer, raw: unknown, ctx: RequestContext = {}, db = prisma, now = new Date()) {
  const input = reviewInputSchema.parse(raw);
  const booking = await getBookingForViewer(reference, viewer, db);
  if (viewer.actor && !viewer.accessToken) {
    // Staff can view any booking but must not write reviews on a customer's behalf.
    const own = await db.customerProfile.findUnique({ where: { userId: viewer.actor.userId }, select: { id: true } });
    if (own?.id !== booking.customerId) throw new DomainError('FORBIDDEN', 'Only the customer who made this booking can review it.');
  }
  if (!canReview(booking, now)) throw new DomainError('INVALID_TRANSITION', 'You can leave a review once your session has taken place.');
  const existing = await db.review.findUnique({ where: { bookingId: booking.id } });
  if (existing?.status === 'HIDDEN') throw new DomainError('CONFLICT', 'This review has been removed by the studio and cannot be edited.');
  const review = await db.review.upsert({
    where: { bookingId: booking.id },
    create: { bookingId: booking.id, serviceId: booking.serviceId, customerId: booking.customerId, rating: input.rating, comment: input.comment ?? null },
    update: { rating: input.rating, comment: input.comment ?? null },
  });
  await recordAudit(viewer.actor, { action: existing ? 'review.updated' : 'review.created', entityType: 'Review', entityId: review.id, summary: `${input.rating}★ for ${booking.reference}` }, ctx, db);
  return review;
}

/** First name and last initial only, so reviews never expose a customer's full name. */
export function publicReviewerName(fullName: string) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : (first ?? 'Customer');
}

/** Aggregate rating per service (published reviews only). */
export async function ratingSummaries(serviceIds: string[], db: Db = prisma) {
  if (!serviceIds.length) return new Map<string, { average: number; count: number }>();
  const rows = await db.review.groupBy({ by: ['serviceId'], where: { serviceId: { in: serviceIds }, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.serviceId, { average: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count._all }]));
}

export async function listServiceReviews(serviceId: string, opts: { take?: number; skip?: number } = {}, db: Db = prisma) {
  const where = { serviceId, status: 'PUBLISHED' as const };
  const [rows, counts] = await Promise.all([
    db.review.findMany({ where, include: { customer: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: opts.take ?? 10, skip: opts.skip ?? 0 }),
    db.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
  ]);
  const total = counts.reduce((s, c) => s + c._count._all, 0);
  const sum = counts.reduce((s, c) => s + c.rating * c._count._all, 0);
  return {
    average: total ? Math.round((sum / total) * 10) / 10 : null,
    count: total,
    distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: counts.find((c) => c.rating === stars)?._count._all ?? 0 })),
    items: rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, author: publicReviewerName(r.customer.fullName), createdAt: r.createdAt.toISOString(), verified: true })),
  };
}

// --- Admin moderation ------------------------------------------------------------------
export async function listReviewsAdmin(status: 'PUBLISHED' | 'HIDDEN' | undefined, db: Db = prisma) {
  return db.review.findMany({
    where: status ? { status } : {},
    include: { service: { select: { name: true } }, customer: { select: { fullName: true, email: true } }, booking: { select: { id: true, reference: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

/** Staff can hide a review (with a reason) or show it again; they cannot edit what the customer wrote. */
export async function moderateReview(id: string, publish: boolean, reason: string | undefined, actor: Actor, ctx: RequestContext = {}, db = prisma) {
  const review = await db.review.findUnique({ where: { id } });
  if (!review) throw notFound('Review');
  if (!publish && !reason?.trim()) throw new DomainError('VALIDATION', 'Give a reason for hiding this review.');
  const updated = await db.review.update({ where: { id }, data: { status: publish ? 'PUBLISHED' : 'HIDDEN', hiddenReason: publish ? null : reason!.trim() } });
  await recordAudit(actor, { action: publish ? 'review.published' : 'review.hidden', entityType: 'Review', entityId: id, summary: publish ? 'Review shown' : `Review hidden: ${reason}` }, ctx, db);
  return updated;
}
