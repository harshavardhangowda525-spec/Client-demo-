import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Brand, Catalog, Me, SiteConfig } from './types';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

export class ApiUnavailableError extends Error {}

/**
 * Server-side API call. Always uncached across requests so pages show live
 * data (bookings, availability, prices) after refresh, but de-duplicated within
 * one render (layout, header and page often need the same data). The visitor's
 * IP is forwarded so API rate limits apply per visitor rather than to this
 * web server as a whole. When `auth` is set, the visitor's session cookie is
 * forwarded so the API can authorise the request itself.
 */
export function serverApi<T>(path: string, opts: { auth?: boolean; allow404?: boolean } = {}): Promise<T | null> {
  return cachedApi(path, !!opts.auth, !!opts.allow404) as Promise<T | null>;
}

const cachedApi = cache(async (path: string, auth: boolean, allow404: boolean): Promise<unknown> => {
  const h: Record<string, string> = {};
  const incoming = await headers();
  const fwd = incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip');
  if (fwd) h['x-forwarded-for'] = fwd;
  if (auth) {
    const jar = await cookies();
    const cookie = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
    if (cookie) h.cookie = cookie;
  }
  const res = await fetchWhileWaking(`${API}${path}`, h);
  if (res.status === 404 && allow404) return null;
  if (res.status === 404) notFound();
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json();
});

/**
 * GET with retries while the API is starting up. Hosting that sleeps idle
 * services (e.g. Render's free plan) answers 502/503/504, or refuses the
 * connection, for up to about a minute while the API wakes; the page waits
 * instead of failing.
 */
async function fetchWhileWaking(url: string, headers: Record<string, string>): Promise<Response> {
  const deadline = Date.now() + 75_000;
  for (let attempt = 0; ; attempt++) {
    try {
      // A per-attempt signal also opts out of Next's in-render fetch memoisation, which would otherwise replay the first failure.
      const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (![502, 503, 504].includes(res.status) || Date.now() > deadline) return res;
    } catch {
      if (Date.now() > deadline) throw new ApiUnavailableError(`The API at ${API} is not reachable. Start it with "pnpm dev".`);
    }
    await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 5000)));
  }
}

export const getSiteConfig = async (brand: Brand) => (await serverApi<SiteConfig>(`/api/v1/sites/${brand}`))!;
export const getCatalog = async (brand: Brand) => (await serverApi<Catalog>(`/api/v1/sites/${brand}/catalog`))!;
export const getMe = () => serverApi<Me>('/api/v1/me', { auth: true });
