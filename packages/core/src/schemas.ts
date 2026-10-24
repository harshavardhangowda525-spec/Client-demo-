// Input validation shared by the API (authoritative) and the websites
// (progressive client-side feedback). Only depends on zod.
import { z } from 'zod';

export const brandSchema = z.enum(['PHOTO', 'PODCAST', 'EVENTS', 'STUDIO']);
/** Brands that own bookable services. */
export const serviceBrandSchema = z.enum(['PHOTO', 'PODCAST', 'EVENTS']);
export type BrandValue = z.infer<typeof brandSchema>;

const id = z.string().min(1).max(64);
const trimmed = (max: number) => z.string().trim().max(max);

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');
export const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the format HH:MM');

// Indian and international numbers: digits, spaces, +, -, parentheses.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number');

export const contactSchema = z.object({
  name: trimmed(120).min(2, 'Enter your full name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
});

export const quoteRequestSchema = z.object({
  serviceId: id,
  packageId: id.optional().nullable(),
  addOnIds: z.array(id).max(20).default([]),
  durationMin: z.coerce.number().int().positive().max(24 * 60).optional().nullable(),
  locationId: id.optional().nullable(),
});

export const availabilityQuerySchema = z.object({
  serviceId: id,
  locationId: id,
  date: dateString,
  days: z.coerce.number().int().min(1).max(42).optional(),
  durationMin: z.coerce.number().int().positive().max(24 * 60).optional(),
  packageId: id.optional(),
});

export const createBookingSchema = z.object({
  brand: serviceBrandSchema,
  serviceId: id,
  packageId: id.optional().nullable(),
  addOnIds: z.array(id).max(20).default([]),
  locationId: id,
  date: dateString,
  startTime: timeString,
  durationMin: z.coerce.number().int().positive().max(24 * 60).optional().nullable(),
  attendees: z.coerce.number().int().min(1).max(5000).optional().nullable(),
  contact: contactSchema,
  notes: trimmed(2000).optional(),
  acceptTerms: z.literal(true, { message: 'Please accept the booking terms' }),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingLookupSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^[A-Z]{2}-[0-9A-Z]{8}$/, 'Enter the reference exactly as shown, e.g. PH-7K3Q9XMR'),
  email: z.string().trim().toLowerCase().email('Enter the email used for the booking'),
});

export const createEnquirySchema = z
  .object({
    categoryId: id.optional().nullable(),
    eventType: trimmed(120).min(2, 'Choose or describe the event type'),
    preferredDate: dateString,
    alternateDate: dateString.optional().nullable().or(z.literal('').transform(() => null)),
    locationId: id.optional().nullable().or(z.literal('').transform(() => null)),
    venueDetails: trimmed(500).optional(),
    expectedAttendance: z.coerce.number().int().min(1, 'Enter the expected number of guests').max(100_000),
    serviceIds: z.array(id).max(20).default([]),
    budgetMinMinor: z.coerce.number().int().min(0).optional().nullable(),
    budgetMaxMinor: z.coerce.number().int().min(0).optional().nullable(),
    setupRequirements: trimmed(3000).optional(),
    notes: trimmed(3000).optional(),
    companyName: trimmed(160).optional(),
    expectedDuration: trimmed(120).optional(),
    deliverables: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
    contact: contactSchema,
    acceptTerms: z.literal(true, { message: 'Please confirm you have read the privacy notice' }),
  })
  .refine((v) => v.budgetMinMinor == null || v.budgetMaxMinor == null || v.budgetMaxMinor >= v.budgetMinMinor, {
    message: 'Maximum budget must be greater than or equal to the minimum',
    path: ['budgetMaxMinor'],
  });
export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

export const contactMessageSchema = z.object({
  brand: brandSchema,
  name: trimmed(120).min(2, 'Enter your name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: phoneSchema.optional().or(z.literal('').transform(() => undefined)),
  subject: trimmed(200).min(2, 'Add a subject'),
  message: trimmed(5000).min(10, 'Please write at least 10 characters'),
});

export const profileUpdateSchema = z.object({
  fullName: trimmed(120).min(2),
  phone: phoneSchema.optional().nullable().or(z.literal('').transform(() => null)),
  company: trimmed(120).optional().nullable(),
  marketingOptIn: z.boolean().optional(),
});

export const notificationPreferencesSchema = z.object({
  notifyEmail: z.boolean(),
  notifyWhatsapp: z.boolean(),
  /** Must be true to enable WhatsApp; recorded with a timestamp as consent. */
  whatsappConsent: z.boolean().optional(),
});

export const rescheduleRequestSchema = z.object({
  date: dateString,
  startTime: timeString,
  reason: trimmed(500).optional(),
});

export const studioListingQuerySchema = z.object({
  category: z.string().max(80).optional(),
  q: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  maxDuration: z.coerce.number().int().min(15).max(1440).optional(),
  city: z.string().max(80).optional(),
  equipment: z.string().max(64).optional(),
  type: z.enum(['package', 'hourly', 'fixed', 'quote']).optional(),
  date: dateString.optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'duration', 'name']).default('popular'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

export const paymentStartSchema = z.object({
  purpose: z.enum(['DEPOSIT', 'BALANCE', 'FULL']).default('DEPOSIT'),
});

export const quotationLineSchema = z.object({
  description: trimmed(300).min(2),
  quantity: z.coerce.number().positive().max(10_000),
  unitPriceMinor: z.coerce.number().int().min(0).max(1_000_000_000),
});

export const quotationDraftSchema = z.object({
  lines: z.array(quotationLineSchema).min(1).max(50),
  discountMinor: z.coerce.number().int().min(0).default(0),
  depositBps: z.coerce.number().int().min(0).max(10_000).optional(),
  validUntil: dateString.optional(),
  terms: trimmed(5000).optional(),
  customerMessage: trimmed(3000).optional(),
});

export const convertQuotationSchema = z.object({
  serviceId: id,
  locationId: id,
  date: dateString,
  startTime: timeString,
  durationMin: z.coerce.number().int().positive().max(24 * 60),
  resourceId: id.optional().nullable(),
});

export const rescheduleSchema = z.object({
  date: dateString,
  startTime: timeString,
  reason: trimmed(500).min(3),
});

export const transitionSchema = z.object({
  to: z.enum([
    'AWAITING_REVIEW',
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLATION_REQUESTED',
    'CANCELLED',
    'REJECTED',
  ]),
  reason: trimmed(500).optional(),
});
