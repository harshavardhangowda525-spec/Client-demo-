'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { formatCalendarDate, formatDuration } from '../lib/format';
import type { PublicLocation, PublicService } from '../lib/types';
import { Calendar, type CalendarDay } from './Calendar';

interface AvailabilityResponse {
  timezone: string;
  durationMin: number;
  isDemoAvailability: boolean;
  days: { date: string; isOpen: boolean; slots: { startTime: string; endTime: string; available: number }[] }[];
}

/** Read-only availability calendar with deep links into the booking flow. */
export function AvailabilityExplorer({ services, locations, timezone, locationLabel = 'Studio' }: { services: PublicService[]; locations: PublicLocation[]; timezone: string; locationLabel?: string }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const service = services.find((s) => s.id === serviceId);
  const locs = useMemo(() => locations.filter((l) => service?.locationIds.includes(l.id)), [locations, service]);
  const [locationId, setLocationId] = useState(locs[0]?.id ?? '');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState<string | null>(null);
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locs.some((l) => l.id === locationId)) setLocationId(locs[0]?.id ?? '');
  }, [locs, locationId]);

  useEffect(() => {
    if (!service || !locationId) return;
    const ctrl = new AbortController();
    const first = `${month}-01` < today ? today : `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const qs = new URLSearchParams({ serviceId: service.id, locationId, date: first, days: String(last - Number(first.slice(8)) + 1) });
    const pkg = service.packages.find((p) => p.isFeatured) ?? service.packages[0];
    if (pkg) qs.set('packageId', pkg.id);
    else qs.set('durationMin', String(service.defaultDurationMin));
    setLoading(true);
    api<AvailabilityResponse>(`/api/v1/availability?${qs}`, { signal: ctrl.signal }).then((res) => {
      if (res.ok) {
        setData(res.data);
        setError(null);
      } else if (res.error.code !== 'ABORTED') setError(res.error.message);
      setLoading(false);
    });
    return () => ctrl.abort();
  }, [service, locationId, month, today]);

  const days = useMemo(() => {
    const out: Record<string, CalendarDay> = {};
    for (const d of data?.days ?? []) out[d.date] = { date: d.date, isOpen: d.isOpen, slotCount: d.slots.length };
    return out;
  }, [data]);
  const slots = data?.days.find((d) => d.date === date)?.slots ?? [];
  const maxMonth = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 120);
    return d.toISOString().slice(0, 7);
  })();

  return (
    <div className="booking-layout">
      <div className="stack-lg">
        <div className="form-row form-row--2">
          <div className="field">
            <label htmlFor="av-service">Session type</label>
            <select id="av-service" className="select" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setDate(null); }}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="av-location">{locationLabel}</label>
            <select id="av-location" className="select" value={locationId} onChange={(e) => { setLocationId(e.target.value); setDate(null); }}>
              {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        {data?.isDemoAvailability && <span className="badge badge--demo">Demonstration availability</span>}
        {error && <div className="alert alert--danger" role="alert">{error}</div>}
        <Calendar month={month} days={days} selected={date} onSelect={setDate} onMonthChange={setMonth} minMonth={today.slice(0, 7)} maxMonth={maxMonth} loading={loading} />
      </div>
      <aside className="card booking-summary" aria-live="polite">
        <p className="eyebrow">{date ? formatCalendarDate(date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Choose a date'}</p>
        {service && data && <p className="small muted">{formatDuration(data.durationMin)} sessions · times in {timezone}</p>}
        {date ? (
          slots.length ? (
            <div className="slots">
              {slots.map((s) => (
                <a key={s.startTime} className="slot" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={`/book?service=${service?.slug}&location=${locationId}&date=${date}&time=${s.startTime}`} aria-label={`Book ${s.startTime} to ${s.endTime}`}>
                  {s.startTime}
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">Fully booked on this day.</p>
          )
        ) : (
          <p className="muted">Days with a dot have free times. Select one to see start times and book.</p>
        )}
      </aside>
    </div>
  );
}
