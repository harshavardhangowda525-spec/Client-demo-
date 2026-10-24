import { prisma, type Db, type Location, type Service } from '@studio/db';
import { DomainError, invalid, notFound } from '../errors';
import { getSetting } from '../settings';
import { addDays, parseLocalDate, todayIn, type LocalDate, zonedToUtc } from '../time';
import { ACTIVE_BOOKING_STATUSES } from '../booking/status';
import { computeAvailability, type AvailabilityRules, type DayAvailability, type Interval, type ResourceSchedule, type WeeklyHours } from './engine';
import { resolveDuration } from '../pricing/service';

export interface AvailabilityContext {
  service: Service;
  location: Location;
  rules: AvailabilityRules;
  locationHours: WeeklyHours[];
  locationBlocks: Interval[];
  resources: ResourceSchedule[];
}

/** Release slot holds whose payment window has lapsed. Safe to call repeatedly. */
export async function expireStaleHolds(db: Db = prisma, now = new Date()): Promise<number> {
  const stale = await db.booking.findMany({
    where: { status: { in: ['AWAITING_PAYMENT', 'PAYMENT_PENDING'] }, holdExpiresAt: { lt: now } },
    select: { id: true, status: true },
  });
  for (const b of stale) {
    // Conditional update: only expire if nobody changed the booking concurrently.
    const updated = await db.booking.updateMany({
      where: { id: b.id, status: b.status, holdExpiresAt: { lt: now } },
      data: { status: 'CANCELLED', cancellationReason: 'Payment window expired; slot released.', holdExpiresAt: null, version: { increment: 1 } },
    });
    if (updated.count) {
      await db.bookingStatusHistory.create({
        data: { bookingId: b.id, fromStatus: b.status, toStatus: 'CANCELLED', actorType: 'SYSTEM', reason: 'Payment window expired; slot released.' },
      });
    }
  }
  return stale.length;
}

/**
 * Load everything needed to evaluate availability for a service at a location
 * between two instants.
 */
export async function loadAvailabilityContext(
  params: { serviceId: string; locationId: string; durationMin: number; from: Date; to: Date; excludeBookingId?: string; now?: Date },
  db: Db = prisma,
): Promise<AvailabilityContext> {
  const now = params.now ?? new Date();
  const [service, location] = await Promise.all([
    db.service.findUnique({ where: { id: params.serviceId } }),
    db.location.findUnique({ where: { id: params.locationId } }),
  ]);
  if (!service || !service.isActive) throw notFound('Service');
  if (!location || !location.isActive) throw notFound('Location');
  const offered = await db.serviceLocation.findUnique({
    where: { serviceId_locationId: { serviceId: service.id, locationId: location.id } },
  });
  if (!offered) throw invalid(`${service.name} is not offered at ${location.name}.`);

  const rulesCfg = await getSetting('bookingRules', db);
  const tz = location.timezone;

  const [locationHoursRows, resourceRows, blocks, bookings] = await Promise.all([
    db.openingHours.findMany({ where: { locationId: location.id, resourceId: null } }),
    service.requiresResource
      ? db.resource.findMany({
          where: { locationId: location.id, isActive: true, isExclusive: true, services: { some: { serviceId: service.id } } },
          include: { openingHours: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    db.blockedPeriod.findMany({
      where: {
        startsAt: { lt: params.to },
        endsAt: { gt: params.from },
        OR: [{ locationId: location.id, resourceId: null }, { resource: { locationId: location.id } }],
      },
    }),
    db.booking.findMany({
      where: {
        locationId: location.id,
        resourceId: { not: null },
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        blockedFrom: { lt: params.to },
        blockedUntil: { gt: params.from },
        ...(params.excludeBookingId ? { id: { not: params.excludeBookingId } } : {}),
      },
      select: { resourceId: true, blockedFrom: true, blockedUntil: true },
    }),
  ]);

  if (service.requiresResource && resourceRows.length === 0) {
    throw new DomainError('UNAVAILABLE', `${service.name} has no bookable resources at ${location.name}.`);
  }

  const toHours = (rows: { dayOfWeek: number; openMinute: number; closeMinute: number }[]) =>
    rows.map((r) => ({ dayOfWeek: r.dayOfWeek, openMinute: r.openMinute, closeMinute: r.closeMinute }));

  const resources: ResourceSchedule[] = resourceRows.map((r) => ({
    id: r.id,
    name: r.name,
    hours: toHours(r.openingHours),
    busy: [
      ...bookings.filter((b) => b.resourceId === r.id).map((b) => ({ from: b.blockedFrom, to: b.blockedUntil })),
      ...blocks.filter((b) => b.resourceId === r.id).map((b) => ({ from: b.startsAt, to: b.endsAt })),
    ],
  }));

  const today = todayIn(tz, now);
  return {
    service,
    location,
    rules: {
      timezone: tz,
      durationMin: params.durationMin,
      bufferMin: service.bufferMin,
      slotIntervalMin: service.slotIntervalMin,
      earliestStart: new Date(now.getTime() + rulesCfg.leadTimeHours * 3_600_000),
      lastBookableDate: addDays(today, rulesCfg.maxAdvanceDays),
      requiresResource: service.requiresResource,
    },
    locationHours: toHours(locationHoursRows),
    locationBlocks: blocks.filter((b) => !b.resourceId).map((b) => ({ from: b.startsAt, to: b.endsAt })),
    resources,
  };
}

export interface AvailabilityQuery {
  serviceId: string;
  locationId: string;
  date: string; // YYYY-MM-DD, local to the location
  days?: number;
  durationMin?: number | null;
  packageId?: string | null;
}

export interface AvailabilityResult {
  timezone: string;
  durationMin: number;
  isDemoAvailability: boolean;
  days: DayAvailability[];
}

export async function getAvailability(q: AvailabilityQuery, db: Db = prisma, now = new Date()): Promise<AvailabilityResult> {
  const date = parseLocalDate(q.date);
  if (!date) throw invalid('Date must be a valid calendar date in YYYY-MM-DD format.');
  const days = Math.min(Math.max(q.days ?? 1, 1), 42);

  const service = await db.service.findUnique({ where: { id: q.serviceId } });
  if (!service || !service.isActive) throw notFound('Service');
  const pkg = q.packageId ? await db.package.findUnique({ where: { id: q.packageId } }) : null;
  if (q.packageId && (!pkg || pkg.serviceId !== service.id || !pkg.isActive)) throw invalid('The selected package is not available for this service.');
  const durationMin = resolveDuration(service, pkg, q.durationMin);

  await expireStaleHolds(db, now);
  const location = await db.location.findUnique({ where: { id: q.locationId } });
  if (!location) throw notFound('Location');
  const from = zonedToUtc(date, 0, location.timezone);
  const to = zonedToUtc(addDays(date, days + 1), 0, location.timezone);
  const ctx = await loadAvailabilityContext({ serviceId: service.id, locationId: location.id, durationMin, from, to, now }, db);
  const rulesCfg = await getSetting('bookingRules', db);

  return {
    timezone: location.timezone,
    durationMin,
    isDemoAvailability: rulesCfg.isDemoAvailability,
    days: computeAvailability(date as LocalDate, days, ctx.rules, ctx.locationHours, ctx.locationBlocks, ctx.resources),
  };
}
