'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatMoney } from '@studio/ui';
import type { StudioSearch } from '../lib/types';

/** Header search with live suggestions (combobox pattern). Enter opens the full results page. */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<StudioSearch | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const r = await api<StudioSearch>(`/api/v1/studio/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
      if (r.ok) {
        setRes(r.data);
        setActive(-1);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const options = [
    ...(res?.categories ?? []).map((c) => ({ key: `c-${c.slug}`, href: `/services/${c.slug}`, label: c.name, kind: 'Category' as const, thumb: null as string | null, price: null as number | null })),
    ...(res?.services ?? []).slice(0, 6).map((s) => ({ key: `s-${s.id}`, href: `/service/${s.slug}`, label: s.name, kind: 'Service' as const, thumb: s.imageKey, price: s.fromPriceMinor })),
  ];
  const showList = open && q.trim().length >= 2 && res !== null;

  function go(href: string) {
    setOpen(false);
    setQ('');
    router.push(href);
  }

  return (
    <div className={`st-search ${className ?? ''}`} ref={wrap}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const opt = options[active];
          if (opt) go(opt.href);
          else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <svg className="st-search__icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <label htmlFor={`${id}-q`} className="visually-hidden">Search services</label>
        <input
          id={`${id}-q`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${id}-${options[active]!.key}` : undefined}
          autoComplete="off"
          placeholder="Search for photography, podcast studios, video production…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </form>
      {showList && (
        <ul className="st-suggest" id={`${id}-list`} role="listbox" aria-label="Suggestions">
          {options.length === 0 && <li className="small muted" style={{ padding: 'var(--space-3)' }}>No services match &ldquo;{q.trim()}&rdquo;.</li>}
          {options.map((o, i) => (
            <li key={o.key}>
              <div
                id={`${id}-${o.key}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(o.href)}
                onMouseEnter={() => setActive(i)}
                style={{ cursor: 'pointer' }}
              >
                {o.kind === 'Service' && (
                  <span className="st-suggest__thumb">{o.thumb && <img src={`/media/${o.thumb}-640.webp`} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />}</span>
                )}
                <span style={{ display: 'grid' }}>
                  <span style={{ fontWeight: 700 }}>{o.label}</span>
                  <span className="small muted">{o.kind === 'Category' ? 'Category' : o.price != null ? `From ${formatMoney(o.price)}` : 'Custom quote'}</span>
                </span>
              </div>
            </li>
          ))}
          {options.length > 0 && (
            <li>
              <div role="option" aria-selected={false} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)} style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 700 }}>
                See all results for &ldquo;{q.trim()}&rdquo;
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
