import type { NotificationChannel } from '@studio/db';
import { getEnv } from '../env';

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationAdapter {
  channel: NotificationChannel;
  provider: string;
  isConfigured(): boolean;
  send(to: string, subject: string | undefined, text: string): Promise<SendResult>;
}

const resendEmail: NotificationAdapter = {
  channel: 'EMAIL',
  provider: 'resend',
  isConfigured: () => !!(getEnv().RESEND_API_KEY && getEnv().EMAIL_FROM),
  async send(to, subject, text) {
    const env = getEnv();
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    return res.ok ? { ok: true, providerMessageId: body.id } : { ok: false, error: body.message ?? `HTTP ${res.status}` };
  },
};

function twilio(channel: 'SMS' | 'WHATSAPP'): NotificationAdapter {
  const fromVar = channel === 'SMS' ? 'TWILIO_SMS_FROM' : 'TWILIO_WHATSAPP_FROM';
  return {
    channel,
    provider: 'twilio',
    isConfigured: () => {
      const env = getEnv();
      return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env[fromVar]);
    },
    async send(to, _subject, text) {
      const env = getEnv();
      const prefix = channel === 'WHATSAPP' ? 'whatsapp:' : '';
      const form = new URLSearchParams({ To: `${prefix}${to}`, From: `${prefix}${env[fromVar]}`, Body: text });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      return res.ok ? { ok: true, providerMessageId: body.sid } : { ok: false, error: body.message ?? `HTTP ${res.status}` };
    },
  };
}

// Push notifications are reserved for the future mobile app; no provider is wired yet.
const pushNotConfigured: NotificationAdapter = {
  channel: 'PUSH',
  provider: 'none',
  isConfigured: () => false,
  async send() {
    return { ok: false, error: 'Push provider not configured' };
  },
};

export const ADAPTERS: Record<NotificationChannel, NotificationAdapter> = {
  EMAIL: resendEmail,
  SMS: twilio('SMS'),
  WHATSAPP: twilio('WHATSAPP'),
  PUSH: pushNotConfigured,
};
