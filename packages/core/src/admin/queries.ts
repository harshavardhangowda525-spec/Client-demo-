import { prisma, type Brand, type BookingStatus, type Db, Prisma } from '@studio/db';
import { ACTIVE_BOOKING_STATUSES } from '../booking/status';
import { notificationPreviewsEnabled } from '../env';
import { addDays, localDayOfWeek, todayIn, zonedToUtc } from '../time';

const PAGE_MAX = 100;
const page = (p?: number, size?: number) => {
  const take = Math.min(Math.max(size ?? 25, 1), PAGE_MAX);
  const skip = (Math.max(p ?? 1, 1) - 1) * take;
  return { take, skip };
};

/** All figures are computed from live records; nothing is hard-coded. */
export async function getDashboard(db: Db = prisma, now = new Date()) {
  const in7 = new Date(now.getTime() + 7 * 86_400_000);
  const ago30 = new Date(now.getTime() - 30 * 86_400_000);

  const [byStatus, byBrand, upcoming, needsReview, enquiries, followUpsDue, charges, failedPayments, outstanding, recent, contactNew] =
    await Promise.all([
      db.booking.groupBy({ by: ['status'], _count: { _all: true } }),
      db.booking.groupBy({ by: ['brand'], where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } }, _count: { _all: true } }),
      db.booking.findMany({
        where: { status: { in: ['CONFIRMED', 'IN_PROGRESS'] }, startsAt: { gte: now, lte: in7 } },
        include: { service: { select: { name: true } }, location: { select: { name: true } } },
        orderBy: { startsAt: 'asc' },
        take: 10,
      }),
      db.booking.count({ where: { status: { in: ['ENQUIRY_SUBMITTED', 'AWAITING_REVIEW', 'CANCELLATION_REQUESTED'] } } }),
      db.eventEnquiry.groupBy({ by: ['status'], _count: { _all: true } }),
      db.enquiryFollowUp.count({ where: { completedAt: null, dueAt: { lte: in7 } } }),
      db.transaction.groupBy({
        by: ['isSimulated', 'type'],
        where: { status: 'SUCCEEDED', createdAt: { gte: ago30 } },
        _sum: { amountMinor: true },
        _count: { _all: true },
      }),
      db.paymentOrder.count({ where: { status: 'FAILED', createdAt: { gte: ago30 } } }),
      db.booking.findMany({
        where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] } },
        select: { totalMinor: true, amountPaidMinor: true, isDemo: true },
      }),
      db.booking.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { service: { select: { name: true } } },
      }),
      db.contactMessage.count({ where: { status: 'NEW' } }),
    ]);

  // Popular services and today's resource occupancy, computed from live records.
  const ago90 = new Date(now.getTime() - 90 * 86_400_000);
  const [popularRaw, totalEnquiries, pendingReschedules, resources, todayBookings] = await Promise.all([
    db.booking.groupBy({ by: ['serviceId'], where: { createdAt: { gte: ago90 }, status: { notIn: ['CANCELLED', 'REJECTED'] } }, _count: { _all: true }, orderBy: { _count: { serviceId: 'desc' } }, take: 5 }),
    db.eventEnquiry.count(),
    db.rescheduleRequest.count({ where: { status: 'PENDING' } }),
    db.resource.findMany({ where: { isActive: true, isExclusive: true }, include: { location: { include: { openingHours: { where: { resourceId: null } } } }, openingHours: true } }),
    db.booking.findMany({
      where: { resourceId: { not: null }, status: { in: [...ACTIVE_BOOKING_STATUSES] }, startsAt: { lt: new Date(now.getTime() + 86_400_000) }, endsAt: { gt: new Date(now.getTime() - 86_400_000) } },
      select: { resourceId: true, startsAt: true, endsAt: true },
    }),
  ]);
  const serviceNames = new Map((await db.service.findMany({ where: { id: { in: popularRaw.map((p) => p.serviceId) } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
  const occupancy = resources.map((r) => {
    const tz = r.location.timezone;
    const today = todayIn(tz, now);
    const dow = localDayOfWeek(today, tz);
    const hours = (r.openingHours.length ? r.openingHours : r.location.openingHours).filter((h) => h.dayOfWeek === dow);
    const openMin = hours.reduce((sum, h) => sum + (h.closeMinute - h.openMinute), 0);
    const start = zonedToUtc(today, 0, tz);
    const end = zonedToUtc(addDays(today, 1), 0, tz);
    const bookedMin = todayBookings
      .filter((b) => b.resourceId === r.id)
      .reduce((sum, b) => sum + Math.max(0, (Math.min(+b.endsAt, +end) - Math.max(+b.startsAt, +start)) / 60_000), 0);
    return { resourceId: r.id, resource: r.name, location: r.location.name, openMinutes: openMin, bookedMinutes: Math.round(bookedMin) };
  });

  const money = (simulated: boolean, type: 'CHARGE' | 'REFUND') => {
    const row = charges.find((c) => c.isSimulated === simulated && c.type === type);
    return { amountMinor: row?._sum.amountMinor ?? 0, count: row?._count._all ?? 0 };
  };

  return {
    generatedAt: now.toISOString(),
    bookingsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])) as Partial<Record<BookingStatus, number>>,
    activeBookingsByBrand: Object.fromEntries(byBrand.map((r) => [r.brand, r._count._all])) as Partial<Record<Brand, number>>,
    needsReview,
    totals: {
      bookings: byStatus.reduce((s, r) => s + r._count._all, 0),
      enquiries: totalEnquiries,
      pendingReschedules,
    },
    popularServices: popularRaw.map((p) => ({ serviceId: p.serviceId, name: serviceNames.get(p.serviceId) ?? 'Service', bookings: p._count._all })),
    occupancyToday: occupancy,
    enquiriesByStatus: Object.fromEntries(enquiries.map((r) => [r.status, r._count._all])),
    followUpsDue,
    newContactMessages: contactNew,
    last30Days: {
      realCharges: money(false, 'CHARGE'),
      realRefunds: money(false, 'REFUND'),
      simulatedCharges: money(true, 'CHARGE'),
      simulatedRefunds: money(true, 'REFUND'),
      failedPaymentOrders: failedPayments,
    },
    outstandingBalanceMinor: {
      real: outstanding.filter((b) => !b.isDemo).reduce((s, b) => s + (b.totalMinor - b.amountPaidMinor), 0),
      demo: outstanding.filter((b) => b.isDemo).reduce((s, b) => s + (b.totalMinor - b.amountPaidMinor), 0),
    },
    upcoming: upcoming.map((b) => ({ id: b.id, reference: b.reference, brand: b.brand, startsAt: b.startsAt, timezone: b.timezone, service: b.service.name, location: b.location.name, contactName: b.contactName, status: b.status })),
    recent: recent.map((b) => ({ id: b.id, reference: b.reference, brand: b.brand, status: b.status, createdAt: b.createdAt, service: b.service.name, contactName: b.contactName, totalMinor: b.totalMinor, isDemo: b.isDemo })),
  };
}

export interface BookingSearch {
  q?: string;
  brand?: Brand;
  status?: BookingStatus;
  paymentStatus?: string;
  from?: string;
  to?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export async function searchBookings(s: BookingSearch, db: Db = prisma) {
  const where: Prisma.BookingWhereInput = {
    ...(s.brand ? { brand: s.brand } : {}),
    ...(s.status ? { status: s.status } : {}),
    ...(s.paymentStatus ? { paymentStatus: s.paymentStatus as Prisma.EnumPaymentStatusFilter['equals'] } : {}),
    ...(s.locationId ? { locationId: s.locationId } : {}),
    ...(s.from || s.to
      ? { startsAt: { ...(s.from ? { gte: new Date(s.from) } : {}), ...(s.to ? { lte: new Date(s.to) } : {}) } }
      : {}),
    ...(s.q
      ? {
          OR: [
            { reference: { contains: s.q.trim(), mode: 'insensitive' } },
            { contactName: { contains: s.q.trim(), mode: 'insensitive' } },
            { contactEmail: { contains: s.q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const { take, skip } = page(s.page, s.pageSize);
  const [total, rows] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: { service: { select: { name: true } }, location: { select: { name: true } }, resource: { select: { name: true } } },
      orderBy: { startsAt: 'desc' },
      take,
      skip,
    }),
  ]);
  return {
    total,
    page: Math.max(s.page ?? 1, 1),
    pageSize: take,
    items: rows.map((b) => ({
      id: b.id,
      reference: b.reference,
      brand: b.brand,
      status: b.status,
      paymentStatus: b.paymentStatus,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      timezone: b.timezone,
      service: b.service.name,
      location: b.location.name,
      resource: b.resource?.name ?? null,
      contactName: b.contactName,
      contactEmail: b.contactEmail,
      totalMinor: b.totalMinor,
      amountPaidMinor: b.amountPaidMinor,
      isDemo: b.isDemo,
    })),
  };
}

export async function getBookingAdmin(id: string, db: Db = prisma) {
  return db.booking.findUnique({
    where: { id },
    include: {
      service: true,
      package: true,
      location: true,
      resource: true,
      customer: true,
      items: { orderBy: { sortOrder: 'asc' } },
      history: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true, email: true } } } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
      paymentOrders: { orderBy: { createdAt: 'desc' } },
      transactions: { orderBy: { createdAt: 'desc' }, include: { refunds: true } },
      refunds: { orderBy: { createdAt: 'desc' } },
      notifications: { orderBy: { createdAt: 'desc' } },
      enquiry: { select: { id: true, reference: true } },
      quotation: { select: { id: true, reference: true, version: true } },
    },
  });
}

export async function searchCustomers(q: string | undefined, p = 1, db: Db = prisma) {
  const where: Prisma.CustomerProfileWhereInput = q
    ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }
    : {};
  const { take, skip } = page(p, 25);
  const [total, rows] = await Promise.all([
    db.customerProfile.count({ where }),
    db.customerProfile.findMany({
      where,
      include: { _count: { select: { bookings: true, enquiries: true } }, user: { select: { id: true, emailVerified: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
  ]);
  return {
    total,
    items: rows.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      company: c.company,
      hasAccount: !!c.user,
      bookings: c._count.bookings,
      enquiries: c._count.enquiries,
      isDemo: c.isDemo,
      createdAt: c.createdAt,
    })),
  };
}

export async function getCustomerAdmin(id: string, db: Db = prisma) {
  return db.customerProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, emailVerified: true, createdAt: true } },
      bookings: { orderBy: { startsAt: 'desc' }, include: { service: { select: { name: true } } } },
      enquiries: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function listEnquiries(s: { status?: string; q?: string; page?: number }, db: Db = prisma) {
  const where: Prisma.EventEnquiryWhereInput = {
    ...(s.status ? { status: s.status as Prisma.EnumEnquiryStatusFilter['equals'] } : {}),
    ...(s.q
      ? { OR: [{ reference: { contains: s.q, mode: 'insensitive' } }, { contactName: { contains: s.q, mode: 'insensitive' } }, { contactEmail: { contains: s.q, mode: 'insensitive' } }] }
      : {}),
  };
  const { take, skip } = page(s.page, 25);
  const [total, items] = await Promise.all([
    db.eventEnquiry.count({ where }),
    db.eventEnquiry.findMany({
      where,
      include: { category: { select: { name: true } }, assignedTo: { select: { name: true } }, _count: { select: { quotations: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
  ]);
  return { total, items };
}

export async function getEnquiryAdmin(id: string, db: Db = prisma) {
  return db.eventEnquiry.findUnique({
    where: { id },
    include: {
      category: true,
      location: true,
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      services: { include: { service: { select: { id: true, name: true } } } },
      quotations: { include: { lines: { orderBy: { sortOrder: 'asc' } }, createdBy: { select: { name: true } } }, orderBy: { version: 'desc' } },
      followUps: { include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      booking: { select: { id: true, reference: true, status: true } },
      attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      notifications: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function listPayments(s: { simulated?: 'true' | 'false'; status?: string; page?: number }, db: Db = prisma) {
  const where: Prisma.TransactionWhereInput = {
    ...(s.simulated ? { isSimulated: s.simulated === 'true' } : {}),
    ...(s.status ? { status: s.status as Prisma.EnumTransactionStatusFilter['equals'] } : {}),
  };
  const { take, skip } = page(s.page, 50);
  const [total, transactions, failedOrders, refunds] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({ where, include: { booking: { select: { id: true, reference: true, contactName: true } }, refunds: true }, orderBy: { createdAt: 'desc' }, take, skip }),
    db.paymentOrder.findMany({ where: { status: 'FAILED' }, include: { booking: { select: { id: true, reference: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.refund.findMany({ include: { booking: { select: { id: true, reference: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return { total, transactions, failedOrders, refunds };
}

export async function listAuditLogs(s: { entityType?: string; entityId?: string; actorUserId?: string; page?: number }, db: Db = prisma) {
  const where: Prisma.AuditLogWhereInput = {
    ...(s.entityType ? { entityType: s.entityType } : {}),
    ...(s.entityId ? { entityId: s.entityId } : {}),
    ...(s.actorUserId ? { actorUserId: s.actorUserId } : {}),
  };
  const { take, skip } = page(s.page, 50);
  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take, skip }),
  ]);
  return { total, items };
}

export async function listNotifications(p = 1, db: Db = prisma) {
  const { take, skip } = page(p, 50);
  const [total, items] = await Promise.all([
    db.notification.count(),
    db.notification.findMany({ orderBy: { createdAt: 'desc' }, take, skip }),
  ]);
  // Message bodies may contain password-reset links; outside development only metadata is shown.
  const previews = notificationPreviewsEnabled();
  return {
    total,
    previewsEnabled: previews,
    items: items.map((n) => (previews ? n : { ...n, body: '[hidden outside development preview mode]' })),
  };
}
