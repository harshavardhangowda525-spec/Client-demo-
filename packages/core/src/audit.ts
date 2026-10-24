import { prisma, type Db, Prisma } from '@studio/db';
import type { Actor, RequestContext } from './actor';

const SENSITIVE_KEY = /pass(word)?|secret|token|otp|signature|card|cvv|authorization/i;

/** Remove values that must never be written to logs (passwords, tokens, payment secrets). */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || depth > 6) return value ?? null;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(
  actor: Actor | null,
  entry: AuditEntry,
  ctx: RequestContext = {},
  db: Db = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? 'system',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: entry.before === undefined ? Prisma.JsonNull : (redact(entry.before) as Prisma.InputJsonValue),
      after: entry.after === undefined ? Prisma.JsonNull : (redact(entry.after) as Prisma.InputJsonValue),
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent?.slice(0, 300),
    },
  });
}
