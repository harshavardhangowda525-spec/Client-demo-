import { createHash } from 'node:crypto';
import { prisma, type Db } from '@studio/db';
import { getEnv, type Env } from '../env';
import { verifyRazorpayCredentials } from '../payments/razorpay';

export type IntegrationState =
  | 'NOT_CONFIGURED'
  | 'AWAITING_CREDENTIALS'
  | 'CONFIGURED_NOT_VERIFIED'
  | 'CONNECTED_VERIFIED'
  | 'ERROR';

export const INTEGRATION_STATE_LABELS: Record<IntegrationState, string> = {
  NOT_CONFIGURED: 'Not configured',
  AWAITING_CREDENTIALS: 'Awaiting credentials',
  CONFIGURED_NOT_VERIFIED: 'Configured, not verified',
  CONNECTED_VERIFIED: 'Connected and verified',
  ERROR: 'Error',
};

interface IntegrationDef {
  key: string;
  name: string;
  category: 'Payments' | 'Email' | 'SMS' | 'WhatsApp' | 'Push' | 'Maps' | 'Authentication';
  vars: (keyof Env)[];
  /** Settings that are recommended but not needed for the integration to work. */
  optionalVars?: (keyof Env)[];
  /** Extra context shown with the state (e.g. test mode, or switched off). */
  note?: (env: Env) => string | null;
  /** True when the business has switched the integration on (so missing vars mean "awaiting"). */
  enabled?: (env: Env) => boolean;
  fallback: string;
  verify?: () => Promise<{ ok: boolean; message: string }>;
  verifiable: boolean;
}

async function httpCheck(url: string, headers: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    return res.ok ? { ok: true, message: 'Credentials accepted by the provider.' } : { ok: false, message: `Provider returned HTTP ${res.status}.` };
  } catch (err) {
    return { ok: false, message: `Could not reach provider: ${(err as Error).message}` };
  }
}

const DEFINITIONS: IntegrationDef[] = [
  {
    key: 'payments.razorpay',
    name: 'Razorpay payments',
    category: 'Payments',
    vars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    // Without the webhook, payments and refunds are confirmed by checking with Razorpay's API instead.
    optionalVars: ['RAZORPAY_WEBHOOK_SECRET'],
    enabled: (env) => env.PAYMENTS_MODE === 'live',
    note: (env) => {
      if (!env.RAZORPAY_KEY_ID) return null;
      const mode = env.RAZORPAY_KEY_ID.startsWith('rzp_test_') ? 'Test mode keys (no real money).' : 'Live keys.';
      return env.PAYMENTS_MODE === 'live' ? `${mode} In use for checkout.` : `${mode} Not in use: PAYMENTS_MODE is "${env.PAYMENTS_MODE}"; set it to "live" to use Razorpay.`;
    },
    fallback: 'Checkout runs in clearly labelled demo mode. Simulated payments never move money.',
    verify: verifyRazorpayCredentials,
    verifiable: true,
  },
  {
    key: 'email.resend',
    name: 'Transactional email (Resend)',
    category: 'Email',
    vars: ['RESEND_API_KEY', 'EMAIL_FROM'],
    fallback: 'Emails are stored as previews in the admin notification inbox and are not sent.',
    verify: () => httpCheck('https://api.resend.com/domains', { Authorization: `Bearer ${getEnv().RESEND_API_KEY}` }),
    verifiable: true,
  },
  {
    key: 'sms.twilio',
    name: 'SMS (Twilio)',
    category: 'SMS',
    vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_SMS_FROM'],
    fallback: 'SMS messages are stored as previews only.',
    verify: () => twilioCheck(),
    verifiable: true,
  },
  {
    key: 'whatsapp.twilio',
    name: 'WhatsApp (Twilio)',
    category: 'WhatsApp',
    vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'],
    fallback: 'WhatsApp messages are stored as previews only.',
    verify: () => twilioCheck(),
    verifiable: true,
  },
  {
    key: 'push',
    name: 'Push notifications',
    category: 'Push',
    vars: [],
    fallback: 'Reserved for the mobile app. No provider selected yet.',
    verifiable: false,
  },
  {
    key: 'maps.google',
    name: 'Google Maps embed',
    category: 'Maps',
    vars: ['GOOGLE_MAPS_EMBED_API_KEY'],
    fallback: 'Location pages show the stored address only. No map, directions or travel times are displayed.',
    verifiable: false,
  },
  {
    key: 'auth.email_verification',
    name: 'Email verification and password reset delivery',
    category: 'Authentication',
    vars: ['RESEND_API_KEY', 'EMAIL_FROM'],
    fallback: 'Simulation: verification and reset links appear in the development notification inbox.',
    verifiable: false,
  },
];

function twilioCheck() {
  const env = getEnv();
  return httpCheck(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, {
    Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
  });
}

/** Changes whenever the credentials change, so an old verification never vouches for new keys. */
function fingerprint(def: IntegrationDef, env: Env): string {
  const material = def.vars.map((v) => `${v}=${env[v] ?? ''}`).join('\n');
  return createHash('sha256').update(material).digest('hex').slice(0, 16);
}

export interface IntegrationStatus {
  key: string;
  name: string;
  category: string;
  state: IntegrationState;
  label: string;
  missing: string[];
  /** Optional settings not yet provided. */
  recommended: string[];
  note: string | null;
  fallback: string;
  verifiable: boolean;
  lastCheckedAt: string | null;
  message: string | null;
}

export async function getIntegrationStatuses(db: Db = prisma): Promise<IntegrationStatus[]> {
  const env = getEnv();
  const out: IntegrationStatus[] = [];
  for (const def of DEFINITIONS) {
    const missing = def.vars.filter((v) => !env[v]);
    const present = def.vars.length - missing.length;
    let state: IntegrationState;
    let message: string | null = null;
    let lastCheckedAt: string | null = null;

    if (def.vars.length === 0 || present === 0) {
      state = def.enabled?.(env) ? 'AWAITING_CREDENTIALS' : 'NOT_CONFIGURED';
    } else if (missing.length) {
      state = 'AWAITING_CREDENTIALS';
    } else {
      const check = await db.integrationCheck.findFirst({
        where: { key: `${def.key}:${fingerprint(def, env)}` },
        orderBy: { checkedAt: 'desc' },
      });
      if (!check) state = 'CONFIGURED_NOT_VERIFIED';
      else {
        state = check.ok ? 'CONNECTED_VERIFIED' : 'ERROR';
        message = check.message;
        lastCheckedAt = check.checkedAt.toISOString();
      }
    }
    out.push({
      key: def.key,
      name: def.name,
      category: def.category,
      state,
      label: INTEGRATION_STATE_LABELS[state],
      missing: missing as string[],
      recommended: (def.optionalVars ?? []).filter((v) => !env[v]) as string[],
      note: def.note?.(env) ?? null,
      fallback: def.fallback,
      verifiable: def.verifiable,
      lastCheckedAt,
      message,
    });
  }
  return out;
}

/** Run a live credential check against the provider and record the outcome. */
export async function verifyIntegration(key: string, db: Db = prisma): Promise<IntegrationStatus> {
  const def = DEFINITIONS.find((d) => d.key === key);
  if (!def) throw new Error('Unknown integration');
  const env = getEnv();
  if (!def.verify || def.vars.some((v) => !env[v])) {
    throw new Error('This integration cannot be verified until all credentials are configured.');
  }
  const result = await def.verify();
  await db.integrationCheck.create({ data: { key: `${def.key}:${fingerprint(def, env)}`, ok: result.ok, message: result.message.slice(0, 500) } });
  const statuses = await getIntegrationStatuses(db);
  return statuses.find((s) => s.key === key)!;
}

/** Public, non-sensitive flags the websites use to label demo behaviour. */
export function publicIntegrationFlags() {
  const env = getEnv();
  return {
    paymentsMode: env.PAYMENTS_MODE,
    paymentsSimulated: env.PAYMENTS_MODE === 'demo',
    paymentsTestMode: env.PAYMENTS_MODE === 'live' && !!env.RAZORPAY_KEY_ID?.startsWith('rzp_test_'),
    mapsEmbedKey: env.GOOGLE_MAPS_EMBED_API_KEY ?? null,
    emailDelivery: !!(env.RESEND_API_KEY && env.EMAIL_FROM),
    whatsappDelivery: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM),
  };
}
