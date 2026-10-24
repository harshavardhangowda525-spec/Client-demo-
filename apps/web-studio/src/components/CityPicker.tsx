'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const COOKIE = 'studio_city';

/** Lets the visitor narrow listings to one city. Stored in a cookie so server pages can use it. */
export function CityPicker({ cities, current }: { cities: string[]; current?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function choose(city: string | null) {
    document.cookie = city ? `${COOKIE}=${encodeURIComponent(city)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax` : `${COOKIE}=; path=/; max-age=0; samesite=lax`;
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="st-city" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        <span><span className="visually-hidden">Location: </span>{current ?? 'All cities'}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <dialog ref={dialog} className="st-dialog" aria-labelledby="city-title" onClose={() => setOpen(false)} onClick={(e) => e.target === dialog.current && setOpen(false)}>
        <div className="stack" style={{ padding: 'var(--space-5)' }}>
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <h2 id="city-title" style={{ fontSize: 'var(--step-1)', margin: 0 }}>Select your city</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Only cities with a studio location are listed.</p>
          <div className="st-chips">
            <button type="button" className={`chip ${!current ? 'chip--active' : ''}`} aria-pressed={!current} onClick={() => choose(null)}>All cities</button>
            {cities.map((c) => (
              <button key={c} type="button" className={`chip ${current === c ? 'chip--active' : ''}`} aria-pressed={current === c} onClick={() => choose(c)}>{c}</button>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
