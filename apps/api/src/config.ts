import { z } from 'zod';
import { getEnv } from '@studio/core';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('127.0.0.1'),
  // Hosting platforms (e.g. Render) provide PORT; API_PORT takes precedence when set.
  API_PORT: z.coerce.number().int().default(Number(process.env.PORT ?? 4000)),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url().default(process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:4000'),
  /** Comma-separated extra origins allowed for CORS/CSRF checks (sites and admin are always included). */
  CORS_ORIGINS: z.string().optional(),
  /** Fastify trustProxy setting. "loopback" trusts the local Next.js proxies. */
  TRUST_PROXY: z.string().default('loopback'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MEDIA_DIR: z.string().optional(),
});

export type ApiConfig = z.infer<typeof schema> & { allowedOrigins: string[] };

let cached: ApiConfig | null = null;

export function apiConfig(): ApiConfig {
  if (cached) return cached;
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.parse(raw);
  const core = getEnv();
  const allowedOrigins = [
    core.SITE_URL_PHOTO,
    core.SITE_URL_PODCAST,
    core.SITE_URL_EVENTS,
    core.SITE_URL_ADMIN,
    parsed.BETTER_AUTH_URL,
    ...(parsed.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
  ].map((u) => new URL(u).origin);
  cached = { ...parsed, allowedOrigins: [...new Set(allowedOrigins)] };
  return cached;
}
