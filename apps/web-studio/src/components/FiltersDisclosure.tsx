'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Filters start open on wide screens and collapsed on phones, so results stay near the top. */
export function FiltersDisclosure({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia('(max-width: 999px)').matches && activeCount === 0) ref.current.open = false;
  }, [activeCount]);
  return (
    <details ref={ref} className="st-panel st-filters" open>
      {children}
    </details>
  );
}
