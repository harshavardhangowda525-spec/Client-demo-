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
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: h, cache: 'no-store' });
  } catch {
    throw new ApiUnavailableError(`The API at ${API} is not reachable. Start it with "pnpm dev".`);
  }
  if (res.status === 404 && allow404) return null;
  if (res.status === 404) notFound();
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json();
});

export const getSiteConfig = async (brand: Brand) => (await serverApi<SiteConfig>(`/api/v1/sites/${brand}`))!;
export const getCatalog = async (brand: Brand) => (await serverApi<Catalog>(`/api/v1/sites/${brand}/catalog`))!;
export const getMe = () => serverApi<Me>('/api/v1/me', { auth: true });
