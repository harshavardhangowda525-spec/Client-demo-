import 'server-only';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Brand, Catalog, Me, SiteConfig } from './types';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

export class ApiUnavailableError extends Error {}

/**
 * Server-side API call. Always uncached so pages show live data (bookings,
 * availability, prices) after refresh. When `auth` is set, the visitor's
 * session cookie is forwarded so the API can authorise the request itself.
 */
export async function serverApi<T>(path: string, opts: { auth?: boolean; allow404?: boolean } = {}): Promise<T | null> {
  const h: Record<string, string> = {};
  if (opts.auth) {
    const jar = await cookies();
    const cookie = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
    if (cookie) h.cookie = cookie;
    const fwd = (await headers()).get('x-forwarded-for');
    if (fwd) h['x-forwarded-for'] = fwd;
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: h, cache: 'no-store' });
  } catch {
    throw new ApiUnavailableError(`The API at ${API} is not reachable. Start it with "pnpm dev".`);
  }
  if (res.status === 404 && opts.allow404) return null;
  if (res.status === 404) notFound();
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

export const getSiteConfig = async (brand: Brand) => (await serverApi<SiteConfig>(`/api/v1/sites/${brand}`))!;
export const getCatalog = async (brand: Brand) => (await serverApi<Catalog>(`/api/v1/sites/${brand}/catalog`))!;
export const getMe = () => serverApi<Me>('/api/v1/me', { auth: true });
