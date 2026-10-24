import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { fromNodeHeaders } from 'better-auth/node';
import { prisma } from '@studio/db';
import { DomainError } from '@studio/core';
import { apiConfig } from './config';
import { auth } from './auth';
import { buildOpenApi } from './http/registry';
import { registerPublicRoutes } from './routes/public';
import { registerCustomerRoutes } from './routes/customer';
import { registerAdminRoutes } from './routes/admin';
import { registerWebhookRoutes } from './routes/webhooks';
import { registerStudioRoutes } from './routes/studio';
import { registerAdminStudioRoutes } from './routes/admin-studio';

const here = dirname(fileURLToPath(import.meta.url));
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildApp(): Promise<FastifyInstance> {
  const cfg = apiConfig();
  const trustProxy = cfg.TRUST_PROXY === 'true' ? true : cfg.TRUST_PROXY === 'false' ? false : cfg.TRUST_PROXY;

  const app = Fastify({
    trustProxy,
    bodyLimit: 256 * 1024,
    logger:
      cfg.NODE_ENV === 'test'
        ? false
        : {
            level: cfg.LOG_LEVEL,
            // Never log credentials, session cookies, tokens or payment secrets.
            redact: {
              paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-booking-token"]', 'req.headers["x-razorpay-signature"]', 'res.headers["set-cookie"]'],
              censor: '[redacted]',
            },
            serializers: {
              // Drop query strings (they can carry guest access tokens).
              req: (req) => ({ method: req.method, url: req.url.split('?')[0], ip: req.ip }),
            },
          },
  });

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], imgSrc: ["'self'", 'data:'] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || cfg.allowedOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Booking-Token'],
  });
  await app.register(rateLimit, {
    global: true,
    max: cfg.NODE_ENV === 'test' ? 10_000 : 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, error: { code: 'RATE_LIMITED', message: `Too many requests. Please try again in ${Math.ceil(ctx.ttl / 1000)} seconds.` } }),
  });

  // CSRF defence for cookie-authenticated browser requests: state-changing
  // requests must come from one of our own origins. (Cookies are also
  // SameSite=Lax.) Bearer-token clients and signed webhooks are unaffected.
  app.addHook('onRequest', async (req) => {
    if (!MUTATING.has(req.method) || !req.headers.cookie) return;
    if (req.url.startsWith('/api/v1/webhooks/')) return;
    const origin = req.headers.origin ?? (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
    if (!origin || !cfg.allowedOrigins.includes(origin)) {
      throw new DomainError('FORBIDDEN', 'Request origin not allowed.');
    }
  });

  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof DomainError) {
      return reply.status(err.httpStatus).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: 'Some fields need attention.', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      });
    }
    const status = (err as FastifyError).statusCode;
    if (status === 429) return reply.status(429).send(err);
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    req.log.error({ err }, 'Unhandled error');
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.', requestId: req.id } });
  });

  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found.' } }));

  // Better Auth handler (sign-up, sign-in, sign-out, session, password reset).
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const url = new URL(req.url, cfg.BETTER_AUTH_URL);
      const request = new Request(url, {
        method: req.method,
        headers: fromNodeHeaders(req.headers),
        body: req.method === 'GET' || req.body == null ? undefined : JSON.stringify(req.body),
      });
      const response = await auth.handler(request);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });

  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, time: new Date().toISOString() };
  });

  registerPublicRoutes(app);
  registerCustomerRoutes(app);
  registerAdminRoutes(app);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } });
  registerStudioRoutes(app);
  registerAdminStudioRoutes(app);
  await registerWebhookRoutes(app);

  app.get('/api/openapi.json', async () => buildOpenApi(cfg.BETTER_AUTH_URL));

  // Sample imagery (downloaded by `pnpm images:fetch`). Served with long cache headers.
  const mediaDir = cfg.MEDIA_DIR ?? resolve(here, '../../../assets/demo-images/generated');
  if (existsSync(mediaDir)) {
    await app.register(fastifyStatic, { root: mediaDir, prefix: '/media/', maxAge: '7d', immutable: false, decorateReply: false });
  }

  return app;
}
