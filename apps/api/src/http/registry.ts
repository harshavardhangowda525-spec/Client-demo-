import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z, type ZodType } from 'zod';
import { fromNodeHeaders } from 'better-auth/node';
import { DomainError, loadActor, requirePermission, type Actor, type PermissionKey, type RequestContext } from '@studio/core';
import { auth } from '../auth';

export type Access = 'public' | 'customer' | PermissionKey;

export interface HandlerArgs<B, Q, P> {
  req: FastifyRequest;
  reply: FastifyReply;
  body: B;
  query: Q;
  params: P;
  actor: Actor | null;
  ctx: RequestContext;
}

export interface RouteDef<B = unknown, Q = unknown, P = unknown> {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  summary: string;
  tags: string[];
  access: Access;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  params?: ZodType<P>;
  rateLimit?: { max: number; timeWindow: string };
  /** Status code for a successful response (default 200). */
  status?: number;
  handler: (args: HandlerArgs<B, Q, P>) => Promise<unknown>;
}

export const registry: RouteDef<any, any, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

declare module 'fastify' {
  interface FastifyRequest {
    actorCache?: Promise<Actor | null>;
  }
}

/** Resolve the signed-in user from the Better Auth session cookie (or bearer token for API clients). */
export function getActor(req: FastifyRequest): Promise<Actor | null> {
  if (!req.actorCache) {
    req.actorCache = (async () => {
      if (!req.headers.cookie && !req.headers.authorization) return null;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session?.user) return null;
      return loadActor(session.user.id);
    })();
  }
  return req.actorCache;
}

export function requestContext(req: FastifyRequest): RequestContext {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

export function defineRoute<B = unknown, Q = unknown, P = unknown>(app: FastifyInstance, def: RouteDef<B, Q, P>) {
  registry.push(def);
  app.route({
    method: def.method,
    url: def.url,
    config: def.rateLimit ? { rateLimit: def.rateLimit } : {},
    handler: async (req, reply) => {
      const actor = await getActor(req);
      if (def.access === 'customer') {
        if (!actor) throw new DomainError('UNAUTHENTICATED', 'Please sign in to continue.');
      } else if (def.access !== 'public') {
        requirePermission(actor, def.access);
      }
      const body = def.body ? def.body.parse(req.body ?? {}) : (undefined as B);
      const query = def.query ? def.query.parse(req.query ?? {}) : (undefined as Q);
      const params = def.params ? def.params.parse(req.params ?? {}) : (undefined as P);
      const result = await def.handler({ req, reply, body, query, params, actor, ctx: requestContext(req) });
      if (def.status) reply.status(def.status);
      return result ?? { ok: true };
    },
  });
}

const ACCESS_DESCRIPTIONS: Record<string, string> = {
  public: 'Public',
  customer: 'Signed-in user (session cookie or bearer token)',
};

/** OpenAPI 3.1 document generated from the same zod schemas that validate requests. */
export function buildOpenApi(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  const toJson = (schema: ZodType) => {
    try {
      return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
    } catch {
      return { type: 'object' };
    }
  };
  for (const r of registry) {
    const path = r.url.replace(/:([A-Za-z]+)/g, '{$1}');
    const params = [...r.url.matchAll(/:([A-Za-z]+)/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    const queryParams: unknown[] = [];
    if (r.query) {
      const js = toJson(r.query) as { properties?: Record<string, unknown>; required?: string[] };
      for (const [name, schema] of Object.entries(js.properties ?? {})) {
        queryParams.push({ name, in: 'query', required: js.required?.includes(name) ?? false, schema });
      }
    }
    paths[path] ??= {};
    paths[path]![r.method.toLowerCase()] = {
      summary: r.summary,
      tags: r.tags,
      description: `Access: ${ACCESS_DESCRIPTIONS[r.access] ?? `Staff with permission \`${r.access}\``}${r.rateLimit ? `. Rate limit: ${r.rateLimit.max} per ${r.rateLimit.timeWindow}` : ''}.`,
      parameters: [...params, ...queryParams],
      ...(r.body ? { requestBody: { required: true, content: { 'application/json': { schema: toJson(r.body) } } } } : {}),
      responses: {
        [String(r.status ?? 200)]: { description: 'Success' },
        '4XX': { description: 'Error: `{ "error": { "code", "message", "details"? } }`' },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Studio Platform API',
      version: '0.1.0',
      description:
        'Shared backend for the photography, podcast and events websites, the admin panel and the future mobile app. ' +
        'Authentication endpoints are provided by Better Auth under /api/auth/* (sign-up/email, sign-in/email, sign-out, get-session, request-password-reset, reset-password).',
    },
    servers: [{ url: serverUrl }],
    paths,
  };
}
