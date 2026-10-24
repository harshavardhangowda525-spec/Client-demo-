import { prisma, Prisma, type Db, type CustomerProfile } from '@studio/db';
import type { Actor } from '../actor';

export interface ContactDetails {
  name: string;
  email: string;
  phone?: string | null;
}

/**
 * Find or create the customer record a booking/enquiry belongs to.
 * - Signed-in users always use their own profile (never one matched by email).
 * - Guests reuse an unlinked guest profile with the same email, so no guest can
 *   attach records to (or read records from) a registered account.
 */
export async function resolveCustomer(actor: Actor | null, contact: ContactDetails, db: Db = prisma): Promise<CustomerProfile> {
  if (actor) {
    const existing = await db.customerProfile.findUnique({ where: { userId: actor.userId } });
    if (existing) return existing;
    return db.customerProfile.create({
      data: { userId: actor.userId, fullName: actor.name || contact.name, email: actor.email, phone: contact.phone ?? null },
    });
  }
  const email = contact.email.trim().toLowerCase();
  const found = await db.customerProfile.findFirst({ where: { userId: null, email: { equals: email, mode: 'insensitive' } } });
  if (found) return found;
  try {
    return await db.customerProfile.create({ data: { fullName: contact.name, email, phone: contact.phone ?? null } });
  } catch (err) {
    // Concurrent guest submissions with the same email: the partial unique index wins; re-read.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await db.customerProfile.findFirst({ where: { userId: null, email: { equals: email, mode: 'insensitive' } } });
      if (again) return again;
    }
    throw err;
  }
}

export async function getOwnProfile(actor: Actor, db: Db = prisma): Promise<CustomerProfile> {
  const existing = await db.customerProfile.findUnique({ where: { userId: actor.userId } });
  if (existing) return existing;
  return db.customerProfile.create({ data: { userId: actor.userId, fullName: actor.name, email: actor.email } });
}
