'use client';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { path: string; message: string }[] | unknown;
}

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: ApiErrorBody; status: number };

/** Browser-side API call through the site's same-origin /api proxy. */
export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers ?? {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'same-origin',
      signal: opts.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (res.ok) return { ok: true, data: json as T, status: res.status };
    const error: ApiErrorBody = json?.error ?? { code: 'HTTP_' + res.status, message: json?.message ?? 'Request failed.' };
    return { ok: false, error, status: res.status };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { ok: false, error: { code: 'ABORTED', message: 'Cancelled' }, status: 0 };
    return { ok: false, error: { code: 'NETWORK', message: 'We could not reach the server. Check your connection and try again.' }, status: 0 };
  }
}

/** Map API validation details to a { field: message } object. */
export function fieldErrors(error: ApiErrorBody | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (error && Array.isArray(error.details)) {
    for (const d of error.details as { path: string; message: string }[]) if (d.path && !out[d.path]) out[d.path] = d.message;
  }
  return out;
}

export function newIdempotencyKey(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
}

const TOKEN_KEY = (ref: string) => `studio-access:${ref.toUpperCase()}`;

/** Guest access tokens are kept in this browser only (never in analytics or URLs after first load). */
export function rememberAccessToken(ref: string, token: string) {
  try {
    localStorage.setItem(TOKEN_KEY(ref), token);
  } catch {
    /* storage unavailable (private mode) */
  }
}

export function recallAccessToken(ref: string): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY(ref));
  } catch {
    return null;
  }
}
