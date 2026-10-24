'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@studio/ui';
import { useSignedIn } from './Session';

// One request per page load, shared by every save button on the page.
let savedIds: Promise<Set<string> | null> | null = null;
function loadSaved() {
  savedIds ??= api<{ id: string }[]>('/api/v1/me/saved').then((r) => (r.ok ? new Set(r.data.map((s) => s.id)) : null));
  return savedIds;
}

export function SaveButton({ serviceId, serviceName, variant = 'icon' }: { serviceId: string; serviceName: string; variant?: 'icon' | 'button' }) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const signedIn = useSignedIn();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    loadSaved().then((set) => {
      if (live) setSaved(!!set?.has(serviceId));
    });
    return () => {
      live = false;
    };
  }, [serviceId, signedIn]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push(`/account?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setBusy(true);
    const next = !saved;
    const res = await api(`/api/v1/me/saved/${serviceId}`, { method: next ? 'PUT' : 'DELETE' });
    setBusy(false);
    if (res.ok) {
      setSaved(next);
      savedIds = null;
    } else if (res.status === 401) router.push(`/account?next=${encodeURIComponent(pathname)}`);
  }

  const label = !signedIn ? `Sign in to save ${serviceName}` : saved ? `Remove ${serviceName} from saved` : `Save ${serviceName}`;
  if (variant === 'button') {
    return (
      <button type="button" className="btn btn--ghost btn--sm" aria-pressed={saved} onClick={toggle} disabled={busy}>
        <span aria-hidden="true" style={{ color: saved ? '#d0234a' : undefined }}>{saved ? '♥' : '♡'}</span> {saved ? 'Saved' : 'Save'}
        <span className="visually-hidden"> {serviceName}</span>
      </button>
    );
  }
  return (
    <button type="button" className="st-save" aria-pressed={saved} aria-label={label} title={label} onClick={toggle} disabled={busy}>
      <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
    </button>
  );
}
