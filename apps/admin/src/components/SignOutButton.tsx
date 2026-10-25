'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@studio/ui';

/** Ends the current session so a different (staff) account can sign in. */
export function SignOutButton({ label = 'Sign out' }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api('/api/auth/sign-out', { body: {} });
        router.refresh();
        setBusy(false);
      }}
    >
      {busy ? 'Signing out…' : label}
    </button>
  );
}
