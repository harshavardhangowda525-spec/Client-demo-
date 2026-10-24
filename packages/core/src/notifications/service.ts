import { prisma, type Db, type NotificationChannel, type Notification } from '@studio/db';
import { ADAPTERS } from './adapters';
import { renderTemplate, type TemplateKey } from './templates';

export interface NotifyInput {
  channel?: NotificationChannel;
  template: TemplateKey;
  recipient: string;
  data: Record<string, string | number | undefined | null>;
  bookingId?: string;
  enquiryId?: string;
}

/**
 * Record and (when a provider is configured) send a notification.
 * - No provider: stored as PREVIEW_ONLY, visible in the development preview inbox.
 * - Provider accepted: ACCEPTED. This is not proof of delivery; DELIVERED is only
 *   set by a provider delivery callback.
 * - Provider error: FAILED with the error recorded. Never reported as sent.
 * Failures never throw: a notification problem must not roll back a booking.
 */
export async function notify(input: NotifyInput, db: Db = prisma): Promise<Notification> {
  const channel = input.channel ?? 'EMAIL';
  const adapter = ADAPTERS[channel];
  const override = await db.notificationTemplate.findUnique({ where: { key: input.template } }).catch(() => null);
  const { subject, text } = renderTemplate(input.template, input.data, override?.isActive ? override : null);
  const configured = adapter.isConfigured();

  const record = await db.notification.create({
    data: {
      channel,
      template: input.template,
      recipient: input.recipient,
      subject,
      body: text,
      status: configured ? 'QUEUED' : 'PREVIEW_ONLY',
      provider: configured ? adapter.provider : null,
      bookingId: input.bookingId,
      enquiryId: input.enquiryId,
    },
  });
  if (!configured) return record;

  try {
    const result = await adapter.send(input.recipient, subject, text);
    return db.notification.update({
      where: { id: record.id },
      data: result.ok
        ? { status: 'ACCEPTED', providerMessageId: result.providerMessageId ?? null }
        : { status: 'FAILED', error: result.error?.slice(0, 500) ?? 'Unknown provider error' },
    });
  } catch (err) {
    return db.notification.update({
      where: { id: record.id },
      data: { status: 'FAILED', error: (err as Error).message.slice(0, 500) },
    });
  }
}

/** Fire-and-forget wrapper that never throws (logs instead). */
export function notifySafely(input: NotifyInput, db: Db = prisma): void {
  notify(input, db).catch((err) => console.error('[notifications] failed to record notification', err));
}
