import { z } from 'zod';
import { prisma, type Db, type Brand } from '@studio/db';
import { isValidTimeZone } from './time';

const feeSchema = z.object({
  code: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  type: z.enum(['PERCENT', 'FIXED']),
  /** Basis points for PERCENT, minor units for FIXED. */
  value: z.number().int().min(0).max(10_000_000),
});

const siteSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  /** Social profile URLs; only shown when set by the business. */
  social: z.object({ instagram: z.string().url().optional(), youtube: z.string().url().optional(), linkedin: z.string().url().optional() }).default({}),
});

export const settingSchemas = {
  business: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    phone: z.string().max(40).optional(),
    isDemo: z.boolean(),
  }),
  regional: z.object({
    timezone: z.string().refine(isValidTimeZone, 'Unknown IANA timezone'),
    currency: z.string().length(3),
    locale: z.string().min(2).max(20),
  }),
  bookingRules: z.object({
    leadTimeHours: z.number().int().min(0).max(24 * 60),
    maxAdvanceDays: z.number().int().min(1).max(730),
    holdMinutes: z.number().int().min(5).max(24 * 60),
    cancellationRequestCutoffHours: z.number().int().min(0).max(24 * 60),
    allowGuestBookings: z.boolean(),
    isDemoAvailability: z.boolean(),
    /** Maximum simultaneously active bookings per customer (0 = unlimited). */
    maxActiveBookingsPerCustomer: z.number().int().min(0).max(100).default(5),
    /** Customers can request a reschedule up to this many hours before the session. */
    rescheduleRequestCutoffHours: z.number().int().min(0).max(24 * 60).default(48),
  }),
  pricing: z.object({
    taxRateBps: z.number().int().min(0).max(10_000),
    taxLabel: z.string().min(1).max(80),
    fees: z.array(feeSchema).max(10),
    depositBps: z.number().int().min(0).max(10_000),
    minimumDepositMinor: z.number().int().min(0),
    quotationValidityDays: z.number().int().min(1).max(365),
    isSample: z.boolean(),
  }),
  cancellationPolicy: z.object({
    text: z.string().min(1).max(5000),
    isSample: z.boolean(),
  }),
  /** "Why choose us" points on the studio site. Only publish claims the business can support. */
  studioHighlights: z
    .array(z.object({ title: z.string().min(1).max(80), text: z.string().min(1).max(300) }))
    .max(8),
  siteContent: z.object({
    STUDIO: siteSchema.default({ name: 'Infinity Studios (demo)', tagline: 'Book photography, video and podcast studios in minutes.', email: 'studio@example.com', social: {} }),
    PHOTO: z.object({ name: z.string(), tagline: z.string(), email: z.string().email(), phone: z.string().optional() }),
    PODCAST: z.object({ name: z.string(), tagline: z.string(), email: z.string().email(), phone: z.string().optional() }),
    EVENTS: z.object({ name: z.string(), tagline: z.string(), email: z.string().email(), phone: z.string().optional() }),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };
export type FeeRule = z.infer<typeof feeSchema>;

/**
 * Defaults are demonstration values only. They are not the client's real
 * policies and are flagged as samples wherever they are displayed.
 */
export const DEFAULT_SETTINGS: Settings = {
  business: { name: 'Infinity Studio Group (demo)', email: 'hello@example.com', isDemo: true },
  regional: { timezone: 'Asia/Kolkata', currency: 'INR', locale: 'en-IN' },
  bookingRules: {
    leadTimeHours: 24,
    maxAdvanceDays: 120,
    holdMinutes: 30,
    cancellationRequestCutoffHours: 48,
    allowGuestBookings: true,
    isDemoAvailability: true,
    maxActiveBookingsPerCustomer: 5,
    rescheduleRequestCutoffHours: 48,
  },
  pricing: {
    taxRateBps: 1800,
    taxLabel: 'GST (sample rate, 18%)',
    fees: [],
    depositBps: 3000,
    minimumDepositMinor: 0,
    quotationValidityDays: 14,
    isSample: true,
  },
  cancellationPolicy: {
    text:
      'Sample policy for demonstration only. Cancellation requests are reviewed by the studio team. ' +
      'Refund eligibility will follow the client-approved cancellation policy once it is provided.',
    isSample: true,
  },
  // Each point describes how this platform actually works, so it is true for the demo.
  studioHighlights: [
    { title: 'Live availability', text: 'See real open slots for each studio and service before you book; a room can never be double-booked.' },
    { title: 'Itemised pricing', text: 'Every price is calculated on our server and shown line by line, including tax and deposit, before you pay.' },
    { title: 'Book or request a quote', text: 'Reserve standard sessions instantly, or send a project brief for a tailored quotation.' },
    { title: 'Manage your bookings online', text: 'Track status, pay, request a reschedule or cancel from your booking page or account.' },
  ],
  siteContent: {
    STUDIO: {
      name: 'Infinity Studios (demo)',
      tagline: 'Book photography, video and podcast studios in minutes.',
      email: 'studio@example.com',
      social: {},
    },
    PHOTO: {
      name: 'Lumen Studio',
      tagline: 'Photography and film, composed with intent.',
      email: 'photo@example.com',
    },
    PODCAST: {
      name: 'Signal Room',
      tagline: 'Studios built for clear conversations.',
      email: 'podcast@example.com',
    },
    EVENTS: {
      name: 'Atelier Events',
      tagline: 'Gatherings, considered in every detail.',
      email: 'events@example.com',
    },
  },
};

export async function getSetting<K extends SettingKey>(key: K, db: Db = prisma): Promise<Settings[K]> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return DEFAULT_SETTINGS[key];
  const parsed = settingSchemas[key].safeParse(row.value);
  // A malformed stored value falls back to the default rather than breaking checkout.
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as Settings[K];
}

export async function getAllSettings(db: Db = prisma): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out = { ...DEFAULT_SETTINGS } as Record<SettingKey, unknown>;
  for (const row of rows) {
    if (row.key in settingSchemas) {
      const parsed = settingSchemas[row.key as SettingKey].safeParse(row.value);
      if (parsed.success) out[row.key as SettingKey] = parsed.data;
    }
  }
  return out as Settings;
}

export async function updateSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  actorUserId: string | null,
  db: Db = prisma,
): Promise<Settings[K]> {
  const parsed = settingSchemas[key].parse(value) as Settings[K];
  await db.setting.upsert({
    where: { key },
    create: { key, value: parsed as object, updatedById: actorUserId },
    update: { value: parsed as object, updatedById: actorUserId },
  });
  return parsed;
}

export function siteContentFor(settings: Settings, brand: Brand) {
  return settings.siteContent[brand];
}

/** Brands whose services appear on the unified studio discovery site. */
export const STUDIO_BRANDS = ['PHOTO', 'PODCAST', 'EVENTS'] as const;
