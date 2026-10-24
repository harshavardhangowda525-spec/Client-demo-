'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, Calendar, formatCalendarDate, formatDuration, formatMoney, type SiteConfig } from '@studio/ui';

interface Quote {
  taxLabel: string;
  totalMinor: number;
  depositMinor: number;
}
import type { StudioService } from '../lib/types';

interface Availability {
  timezone: string;
  isDemoAvailability: boolean;
  days: { date: string; isOpen: boolean; slots: { startTime: string; endTime: string }[] }[];
}

function todayIn(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/**
 * Sticky selection panel on a service page. Everything shown (slots, totals)
 * comes from the API; the final checks happen again when the booking is made.
 */
export function BookingPanel({ service, site, initialPackage }: { service: StudioService; site: SiteConfig; initialPackage?: string }) {
  const tz = site.regional.timezone;
  const today = todayIn(tz);
  const usesPackages = service.packages.length > 0;
  const [packageId, setPackageId] = useState<string | null>(
    (service.packages.find((p) => p.id === initialPackage) ?? service.packages.find((p) => p.isFeatured) ?? service.packages[0])?.id ?? null,
  );
  const durations = useMemo(() => {
    const out: number[] = [];
    for (let d = service.minDurationMin; d <= service.maxDurationMin; d += service.durationStepMin) out.push(d);
    return out;
  }, [service]);
  const [duration, setDuration] = useState(service.defaultDurationMin);
  const [locationId, setLocationId] = useState(service.locations[0]?.id ?? '');
  const [addOns, setAddOns] = useState<string[]>([]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const pkg = service.packages.find((p) => p.id === packageId) ?? null;
  const effectiveDuration = pkg?.durationMin ?? duration;

  const quoteOnly = service.bookingMode === 'ENQUIRY';
  useEffect(() => {
    if (quoteOnly) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const r = await api<Quote>('/api/v1/quotes', { body: { serviceId: service.id, packageId: pkg?.id ?? null, addOnIds: addOns, durationMin: pkg ? null : duration, locationId: locationId || null }, signal: ctrl.signal });
      if (r.ok) {
        setQuote(r.data);
        setQuoteError(null);
      } else if (r.error.code !== 'ABORTED') {
        setQuote(null);
        setQuoteError(r.error.message);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [quoteOnly, service.id, pkg, addOns, duration, locationId]);

  useEffect(() => {
    if (!locationId || quoteOnly) return;
    const ctrl = new AbortController();
    (async () => {
      const first = `${month}-01`;
      const from = first < today ? today : first;
      const [y, m] = month.split('-').map(Number);
      const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
      const qs = new URLSearchParams({ serviceId: service.id, locationId, date: from, days: String(Math.max(1, last - Number(from.slice(8)) + 1)) });
      if (pkg) qs.set('packageId', pkg.id);
      else qs.set('durationMin', String(duration));
      setAvailLoading(true);
      const r = await api<Availability>(`/api/v1/availability?${qs}`, { signal: ctrl.signal });
      if (r.ok) {
        setAvail(r.data);
        setAvailError(null);
      } else if (r.error.code !== 'ABORTED') {
        setAvail(null);
        setAvailError(r.error.message);
      }
      if (!ctrl.signal.aborted) setAvailLoading(false);
    })();
    return () => ctrl.abort();
  }, [quoteOnly, service.id, locationId, month, today, pkg, duration]);

  const days = useMemo(() => Object.fromEntries((avail?.days ?? []).map((d) => [d.date, { date: d.date, isOpen: d.isOpen, slotCount: d.slots.length }])), [avail]);
  const slots = useMemo(() => avail?.days.find((d) => d.date === date)?.slots ?? [], [avail, date]);
  useEffect(() => {
    if (time && avail && date && !slots.some((s) => s.startTime === time)) setTime(null);
  }, [avail, date, slots, time]);

  const maxMonth = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + site.bookingRules.maxAdvanceDays);
    return d.toISOString().slice(0, 7);
  }, [today, site.bookingRules.maxAdvanceDays]);

  if (quoteOnly) {
    return (
      <div className="st-panel stack" id="book">
        <h2 style={{ fontSize: 'var(--step-1)', margin: 0 }}>Custom quotation</h2>
        <p className="small muted" style={{ margin: 0 }}>This service is scoped for each project. Send a brief with your dates, deliverables and references; the team replies with an itemised quotation.</p>
        <Link className="btn btn--block" href={`/enquire?service=${service.slug}`}>Request a quote</Link>
      </div>
    );
  }

  const isRequest = service.bookingMode === 'REQUEST';
  const href = date && time
    ? `/book?${new URLSearchParams({ service: service.slug, location: locationId, date, time, step: '2', ...(pkg ? { package: pkg.id } : { duration: String(duration) }), ...(addOns.length ? { addons: addOns.join(',') } : {}) })}`
    : null;

  return (
    <div className="st-panel stack" id="book" aria-labelledby="book-title">
      <h2 id="book-title" style={{ fontSize: 'var(--step-1)', margin: 0 }}>{isRequest ? 'Request this service' : 'Book this service'}</h2>

      {usesPackages ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 'var(--space-2)' }}>Package</legend>
          <div className="options">
            {service.packages.map((p) => (
              <label key={p.id} className="option">
                <input type="radio" name="pkg" checked={p.id === packageId} onChange={() => { setPackageId(p.id); setTime(null); }} />
                <span>
                  <span className="option__title">{p.name}</span>
                  <span className="option__meta">{formatMoney(p.priceMinor)} · {formatDuration(p.durationMin)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="field">
          <label htmlFor="bp-duration">Duration</label>
          <select id="bp-duration" className="select" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setTime(null); }}>
            {durations.map((d) => <option key={d} value={d}>{formatDuration(d)}</option>)}
          </select>
        </div>
      )}

      {service.locations.length > 1 && (
        <div className="field">
          <label htmlFor="bp-location">Location</label>
          <select id="bp-location" className="select" value={locationId} onChange={(e) => { setLocationId(e.target.value); setDate(null); setTime(null); }}>
            {service.locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}
          </select>
        </div>
      )}

      {service.addOns.length > 0 && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 'var(--space-2)' }}>Add-ons (optional)</legend>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            {service.addOns.map((a) => (
              <label key={a.id} className="checkbox">
                <input type="checkbox" checked={addOns.includes(a.id)} onChange={(e) => setAddOns((cur) => (e.target.checked ? [...cur, a.id] : cur.filter((x) => x !== a.id)))} />
                <span>{a.name} <span className="muted small">+{formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? '/hr' : ''}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <p className="label" style={{ marginBottom: 'var(--space-2)' }}>Date</p>
        {avail?.isDemoAvailability && <p className="badge badge--demo" style={{ marginBottom: 'var(--space-2)' }}>Demonstration availability</p>}
        {availError && <p className="alert alert--danger small" role="alert">{availError}</p>}
        <Calendar month={month} days={days} selected={date} onSelect={(d) => { setDate(d); setTime(null); }} onMonthChange={setMonth} minMonth={today.slice(0, 7)} maxMonth={maxMonth} loading={availLoading} />
      </div>

      {date && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 'var(--space-2)' }}>Start time, {formatCalendarDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</legend>
          {slots.length ? (
            <div className="slots">
              {slots.map((s) => (
                <button key={s.startTime} type="button" className="slot" aria-pressed={time === s.startTime} onClick={() => setTime(s.startTime)} aria-label={`${s.startTime} to ${s.endTime}`}>{s.startTime}</button>
              ))}
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>No times left on this day.</p>
          )}
        </fieldset>
      )}

      <div aria-live="polite" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
        {quote ? (
          <>
            <div className="cluster" style={{ justifyContent: 'space-between' }}>
              <span className="small muted">{formatDuration(effectiveDuration)} · incl. {quote.taxLabel}</span>
              <strong style={{ fontSize: '1.25rem' }}>{formatMoney(quote.totalMinor)}</strong>
            </div>
            {!isRequest && quote.depositMinor > 0 && <p className="small muted" style={{ margin: 0 }}>Deposit to confirm: {formatMoney(quote.depositMinor)}</p>}
            {site.pricing.isSample && <p className="small muted" style={{ margin: 0 }}>Sample price for the demo.</p>}
          </>
        ) : quoteError ? (
          <p className="field-error" style={{ margin: 0 }}>{quoteError}</p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>Calculating price…</p>
        )}
      </div>

      {href ? (
        <Link className="btn btn--block" href={href}>{isRequest ? 'Continue to request' : 'Continue to book'}</Link>
      ) : (
        <button type="button" className="btn btn--block" disabled>Select a date and time</button>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        {isRequest ? 'The team reviews requests before confirming.' : 'Your slot is held while you pay the deposit and is confirmed once payment is verified.'}
      </p>
    </div>
  );
}
