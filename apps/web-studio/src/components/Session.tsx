'use client';

import { createContext, useContext, type ReactNode } from 'react';

const SignedIn = createContext(false);

/** Tells client components whether a customer is signed in, so guests don't trigger account-only requests. */
export function SessionProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  return <SignedIn.Provider value={signedIn}>{children}</SignedIn.Provider>;
}

export const useSignedIn = () => useContext(SignedIn);
