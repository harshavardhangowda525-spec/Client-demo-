import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Crockford base32 without ambiguous characters (no I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Cryptographically random, non-sequential identifier, e.g. "PH-7K3Q9XMR" (40 bits). */
export function generateReference(prefix: string, length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % 32];
  return `${prefix}-${out}`;
}

/** Secret token handed to guests so they can view or pay for their booking. */
export function generateAccessToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: string | undefined | null, hash: string | null): boolean {
  if (!token || !hash) return false;
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const REFERENCE_PREFIX = { PHOTO: 'PH', PODCAST: 'PC', EVENTS: 'EV' } as const;
