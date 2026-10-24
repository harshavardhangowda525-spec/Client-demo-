import { prisma, type Db } from '@studio/db';
import { forbidden, DomainError } from './errors';
import type { PermissionKey } from './permissions';

/** The authenticated principal performing an operation, resolved server-side. */
export interface Actor {
  userId: string;
  email: string;
  name: string;
  role: string;
  isStaff: boolean;
  permissions: ReadonlySet<string>;
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export async function loadActor(userId: string, db: Db = prisma): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roleRef: { include: { permissions: true } } },
  });
  if (!user || !user.isActive) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isStaff: user.roleRef.isStaff,
    permissions: new Set(user.roleRef.permissions.map((p) => p.permissionKey)),
  };
}

export function can(actor: Actor | null | undefined, permission: PermissionKey): boolean {
  return !!actor && actor.isStaff && actor.permissions.has(permission);
}

export function requirePermission(actor: Actor | null | undefined, permission: PermissionKey): Actor {
  if (!actor) throw new DomainError('UNAUTHENTICATED', 'Sign in required.');
  if (!can(actor, permission)) throw forbidden();
  return actor;
}
