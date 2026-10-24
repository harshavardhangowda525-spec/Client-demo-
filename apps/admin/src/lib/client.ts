'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type ApiErrorBody } from '@studio/ui';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export const AdminContext = createContext<AdminUser | null>(null);
export const useAdmin = () => useContext(AdminContext)!;
export const useCan = () => {
  const user = useContext(AdminContext);
  return (p: string) => !!user?.permissions.includes(p);
};

/** Fetch an admin API resource; `reload` re-fetches after mutations. */
export function useAdminData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    const res = await api<T>(path);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else setError(res.error);
    setLoading(false);
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export function mutate<T = unknown>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) {
  return api<T>(path, { method, body: body ?? (method === 'DELETE' ? undefined : {}) });
}

export function errorText(e: ApiErrorBody | null | undefined) {
  if (!e) return null;
  const details = Array.isArray(e.details) ? (e.details as { path: string; message: string }[]).map((d) => `${d.path}: ${d.message}`).join('; ') : '';
  return details ? `${e.message} ${details}` : e.message;
}
