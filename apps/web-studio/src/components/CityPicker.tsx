'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const COOKIE = 'studio_city';
const CHOSEN = 'studio_city_chosen';
const YEAR = 60 * 60 * 24 * 365;

function CityIcon() {
  // A generic skyline: no landmark artwork is implied for any city.
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 42h40M8 42V22h8v20M16 42V12h10v30M26 42V18h8v24M34 42V26h6v16" />
      <path d="M19 17h4M19 22h4M19 27h4M19 32h4M29 23h2M29 28h2M29 33h2M11 27h2M11 32h2" />
    </svg>
  );
}

/**
 * Location selector. Opens automatically on a visitor's first visit (like
 * BookMyShow); the choice is a browsing preference stored in a cookie.
 */
export function CityPicker({ cities, current, askOnLoad }: { cities: string[]; current?: string; askOnLoad: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (askOnLoad) setOpen(true);
  }, [askOnLoad]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function choose(city: string | null) {
    document.cookie = city ? `${COOKIE}=${encodeURIComponent(city)}; path=/; max-age=${YEAR}; samesite=lax` : `${COOKIE}=; path=/; max-age=0; samesite=lax`;
    document.cookie = `${CHOSEN}=1; path=/; max-age=${YEAR}; samesite=lax`;
    setOpen(false);
    router.refresh();
  }

  function dismiss() {
    // Closing without choosing still counts as "asked", so the pop-up doesn't keep returning.
    document.cookie = `${CHOSEN}=1; path=/; max-age=${YEAR}; samesite=lax`;
    setOpen(false);
  }

  const shown = cities.filter((c) => c.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <>
      <button type="button" className="st-city" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span><span className="visually-hidden">Location: </span>{current ?? 'All cities'}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <dialog ref={dialog} className="st-dialog" aria-labelledby="city-title" onClose={dismiss} onClick={(e) => e.target === dialog.current && dismiss()}>
        <div className="stack" style={{ padding: 'var(--space-5)' }}>
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <h2 id="city-title" style={{ fontSize: 'var(--step-1)', margin: 0 }}>Select your city</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={dismiss} aria-label="Close">✕</button>
          </div>
          <label className="visually-hidden" htmlFor="city-filter">Search for your city</label>
          <input id="city-filter" className="input" placeholder="Search for your city" value={filter} onChange={(e) => setFilter(e.target.value)} autoComplete="off" />
          <p className="small muted" style={{ margin: 0 }}>Cities where we have a studio</p>
          <div className="st-city-grid">
            {shown.map((c) => (
              <button key={c} type="button" aria-pressed={current === c} onClick={() => choose(c)}>
                <CityIcon />
                {c}
              </button>
            ))}
            <button type="button" aria-pressed={!current} onClick={() => choose(null)}>
              <CityIcon />
              All cities
            </button>
          </div>
          {shown.length === 0 && filter && <p className="small muted" style={{ margin: 0 }}>No studio in &ldquo;{filter}&rdquo; yet. Choose &ldquo;All cities&rdquo; to see everything.</p>}
        </div>
      </dialog>
    </>
  );
}
