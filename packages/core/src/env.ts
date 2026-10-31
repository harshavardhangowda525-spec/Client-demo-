import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  /** demo = simulated payments only; live = real provider required; disabled = no checkout. */
  PAYMENTS_MODE: z.enum(['demo', 'live', 'disabled']).default('demo'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  GOOGLE_MAPS_EMBED_API_KEY: z.string().optional(),
  /** "Sign in with Google" (OAuth client from Google Cloud). Both must be set to enable it. */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Signs e-ticket QR codes. Falls back to BETTER_AUTH_SECRET so existing deployments need no new setting. */
  TICKET_SIGNING_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_SECRET: z.string().optional(),
  /** Enables the development-only notification preview inbox in the admin panel. */
  NOTIFICATION_PREVIEWS: z.enum(['true', 'false']).optional(),
  SITE_URL_PHOTO: z.string().url().default('http://localhost:3001'),
  SITE_URL_PODCAST: z.string().url().default('http://localhost:3002'),
  SITE_URL_EVENTS: z.string().url().default('http://localhost:3003'),
  SITE_URL_STUDIO: z.string().url().default('http://localhost:3004'),
  SITE_URL_ADMIN: z.string().url().default('http://localhost:3100'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    // Treat empty strings in .env files as "not set".
    const raw = Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''),
    );
    cached = envSchema.parse(raw);
  }
  return cached;
}

/** For tests: re-read process.env on next access. */
export function resetEnvCache() {
  cached = null;
}

export function notificationPreviewsEnabled(): boolean {
  const env = getEnv();
  if (env.NOTIFICATION_PREVIEWS) return env.NOTIFICATION_PREVIEWS === 'true';
  return env.NODE_ENV !== 'production';
}

export function siteUrl(brand: 'PHOTO' | 'PODCAST' | 'EVENTS' | 'STUDIO'): string {
  const env = getEnv();
  return { PHOTO: env.SITE_URL_PHOTO, PODCAST: env.SITE_URL_PODCAST, EVENTS: env.SITE_URL_EVENTS, STUDIO: env.SITE_URL_STUDIO }[brand];
}
