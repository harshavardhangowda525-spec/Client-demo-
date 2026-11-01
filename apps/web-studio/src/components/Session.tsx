'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthPanel } from '@studio/ui';

const SignedIn = createContext(false);
const OpenSignIn = createContext<(next?: string) => void>(() => {});

export interface SignInOptions {
  emailDelivery: boolean;
  googleSignIn: boolean;
  adminUrl: string;
}

/**
 * Tells client components whether a customer is signed in, and lets any of
 * them open the sign-in pop-up (so signing in never leaves the current page).
 */
export function SessionProvider({ signedIn, signIn, children }: { signedIn: boolean; signIn: SignInOptions; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<string | undefined>();
  const [here, setHere] = useState('/');
  const dialog = useRef<HTMLDialogElement>(null);

  const openSignIn = useCallback((target?: string) => {
    setHere(window.location.pathname + window.location.search);
    setNext(target);
    setOpen(true);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Signing in on another tab, or signing out, closes a stale pop-up.
  useEffect(() => {
    if (signedIn) setOpen(false);
  }, [signedIn]);

  function done() {
    setOpen(false);
    if (next && next.startsWith('/') && !next.startsWith('//') && next !== here) router.push(next);
    router.refresh();
  }

  return (
    <SignedIn.Provider value={signedIn}>
      <OpenSignIn.Provider value={openSignIn}>
        {children}
        <dialog ref={dialog} className="st-dialog st-signin-dialog" aria-labelledby="signin-title" onClose={() => setOpen(false)} onClick={(e) => e.target === dialog.current && setOpen(false)}>
          {open && (
            <div className="stack" style={{ padding: 'var(--space-5)' }}>
              <div className="cluster" style={{ justifyContent: 'space-between' }}>
                <h2 id="signin-title" style={{ fontSize: 'var(--step-1)', margin: 0 }}>Sign in to continue</h2>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </div>
              <AuthPanel
                bare
                idPrefix="pop"
                next={next ?? here}
                emailDelivery={signIn.emailDelivery}
                googleSignIn={signIn.googleSignIn}
                adminUrl={signIn.adminUrl}
                onSignedIn={done}
              />
            </div>
          )}
        </dialog>
      </OpenSignIn.Provider>
    </SignedIn.Provider>
  );
}

export const useSignedIn = () => useContext(SignedIn);

/** Opens the sign-in pop-up. `next` is where to go after signing in (default: stay on this page). */
export const useSignIn = () => useContext(OpenSignIn);

/** Header "Sign in" button that opens the pop-up. */
export function SignInButton({ className, children = 'Sign in' }: { className?: string; children?: ReactNode }) {
  const open = useSignIn();
  return (
    <button type="button" className={className} onClick={() => open()} aria-haspopup="dialog">
      {children}
    </button>
  );
}
