import { prisma, type Db } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { invalid, notFound } from '../errors';
import { notificationPreferencesSchema } from '../schemas';
import { STUDIO_BRANDS } from '../settings';
import { getOwnProfile } from '../customers/service';

export async function listSavedServices(actor: Actor, db: Db = prisma) {
  const profile = await getOwnProfile(actor, db);
  const rows = await db.savedService.findMany({
    where: { customerId: profile.id, service: { isActive: true } },
    include: { service: { select: { id: true, slug: true, name: true, summary: true, imageKey: true, brand: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({ ...r.service, savedAt: r.createdAt.toISOString() }));
}

export async function setSavedService(actor: Actor, serviceId: string, saved: boolean, db: Db = prisma) {
  const profile = await getOwnProfile(actor, db);
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isActive || !(STUDIO_BRANDS as readonly string[]).includes(service.brand)) throw notFound('Service');
  if (saved) {
    await db.savedService.upsert({ where: { customerId_serviceId: { customerId: profile.id, serviceId } }, create: { customerId: profile.id, serviceId }, update: {} });
  } else {
    await db.savedService.deleteMany({ where: { customerId: profile.id, serviceId } });
  }
  return { serviceId, saved };
}

export async function updateNotificationPreferences(actor: Actor, raw: unknown, ctx: RequestContext = {}, db: Db = prisma) {
  const input = notificationPreferencesSchema.parse(raw);
  if (input.notifyWhatsapp && !input.whatsappConsent) throw invalid('Please confirm you agree to receive WhatsApp messages.');
  const profile = await getOwnProfile(actor, db);
  const updated = await db.customerProfile.update({
    where: { id: profile.id },
    data: {
      notifyEmail: input.notifyEmail,
      notifyWhatsapp: input.notifyWhatsapp,
      whatsappConsentAt: input.notifyWhatsapp ? (profile.whatsappConsentAt ?? new Date()) : null,
    },
  });
  await recordAudit(actor, { action: 'profile.notification_preferences', entityType: 'CustomerProfile', entityId: profile.id, after: input }, ctx, db);
  return { notifyEmail: updated.notifyEmail, notifyWhatsapp: updated.notifyWhatsapp, whatsappConsentAt: updated.whatsappConsentAt?.toISOString() ?? null };
}
