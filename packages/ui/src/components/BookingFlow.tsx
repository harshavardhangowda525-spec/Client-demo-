'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBookingSchema } from '@studio/core/schemas';
import { api, fieldErrors, rememberAccessToken, type ApiErrorBody } from '../lib/api';
import { formatCalendarDate, formatDuration, formatMoney, priceFrom } from '../lib/format';
import type { BookingDto, Brand, Me, PriceBreakdown as Breakdown, PublicLocation, PublicService, SiteConfig } from '../lib/types';
import { Calendar, type CalendarDay } from './Calendar';
import { PriceBreakdown } from './PriceBreakdown';

interface AvailabilityResponse {
  timezone: string;
  durationMin: number;
  isDemoAvailability: boolean;
  days: { date: string; isOpen: boolean; slots: { startTime: string; endTime: string; available: number }[] }[];
}

export interface BookingFlowProps {
  brand: Brand;
  site: SiteConfig;
  services: PublicService[];
  locations: PublicLocation[];
  me: Me | null;
  initial?: { service?: string; location?: string; date?: string; time?: string; package?: string; duration?: string; addOns?: string[]; step?: number };
  /** Set when the booking is made on a site other than the service's own (e.g. the studio platform). */
  sourceSite?: 'STUDIO';
  labels?: { location?: string; attendees?: string; notesPlaceholder?: string };
  showAttendees?: boolean;
}

const STEPS = ['Service', 'Date & time', 'Your details', 'Review'];

function todayIn(tz: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts; // YYYY-MM-DD
}

export function BookingFlow({ brand, site, services, locations, me, initial = {}, labels = {}, showAttendees, sourceSite }: BookingFlowProps) {
  const router = useRouter();
  const tz = site.regional.timezone;
  const today = todayIn(tz);
  const initialService = services.find((s) => s.slug === initial.service || s.id === initial.service) ?? null;

  // Deep links from a service page can start at the details step once a slot is chosen.
  const [step, setStep] = useState(initialService && initial.date && initial.time && initial.step ? Math.min(Math.max(initial.step, 0), 2) : 0);
  const [serviceId, setServiceId] = useState<string | null>(initialService?.id ?? null);
  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [services, serviceId]);
  const [packageId, setPackageId] = useState<string | null>(
    () => (initialService?.packages.find((p) => p.id === initial.package) ?? initialService?.packages.find((p) => p.isFeatured) ?? initialService?.packages[0])?.id ?? null,
  );
  const [durationMin, setDurationMin] = useState<number | null>(initial.duration && /^\d+$/.test(initial.duration) ? Number(initial.duration) : (initialService?.defaultDurationMin ?? null));
  const [addOnIds, setAddOnIds] = useState<string[]>(() => (initial.addOns ?? []).filter((id) => initialService?.addOns.some((a) => a.id === id)));
  const serviceLocations = useMemo(() => locations.filter((l) => service?.locationIds.includes(l.id)), [locations, service]);
  const [locationId, setLocationId] = useState<string | null>(initial.location ?? null);
  const [month, setMonth] = useState((initial.date ?? today).slice(0, 7));
  const [date, setDate] = useState<string | null>(initial.date ?? null);
  const [startTime, setStartTime] = useState<string | null>(initial.time ?? null);
  const [contact, setContact] = useState({ name: me?.profile.fullName ?? '', email: me?.profile.email ?? '', phone: me?.profile.phone ?? '' });
  const [attendees, setAttendees] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [quote, setQuote] = useState<Breakdown | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<ApiErrorBody | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Keep location valid for the chosen service.
  useEffect(() => {
    if (!service) return;
    if (!locationId || !service.locationIds.includes(locationId)) setLocationId(serviceLocations[0]?.id ?? null);
  }, [service, serviceLocations, locationId]);

  const usesPackages = !!service && service.packages.length > 0;
  const selectedPackage = service?.packages.find((p) => p.id === packageId) ?? null;
  const effectiveDuration = selectedPackage?.durationMin ?? durationMin ?? service?.defaultDurationMin ?? 60;
  const durationOptions = useMemo(() => {
    if (!service || usesPackages) return [];
    const out: number[] = [];
    for (let d = service.minDurationMin; d <= service.maxDurationMin; d += service.durationStepMin) out.push(d);
    return out;
  }, [service, usesPackages]);

  // Authoritative server quote whenever the selection changes.
  useEffect(() => {
    if (!service) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await api<Breakdown>('/api/v1/quotes', {
        body: { serviceId: service.id, packageId: selectedPackage?.id ?? null, addOnIds, durationMin: selectedPackage ? null : effectiveDuration, locationId },
        signal: ctrl.signal,
      });
      if (res.ok) {
        setQuote(res.data);
        setQuoteError(null);
      } else if (res.error.code !== 'ABORTED') {
        setQuote(null);
        setQuoteError(res.error.message);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [service, selectedPackage, addOnIds, effectiveDuration, locationId]);

  // Verified availability for the visible month.
  const loadAvailability = useMemo(
    () => async (signal?: AbortSignal) => {
      if (!service || !locationId) return;
      const firstOfMonth = `${month}-01`;
      const from = firstOfMonth < today ? today : firstOfMonth;
      const [y, m] = month.split('-').map(Number);
      const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
      const days = last - Number(from.slice(8)) + 1;
      const qs = new URLSearchParams({ serviceId: service.id, locationId, date: from, days: String(Math.max(1, days)) });
      if (selectedPackage) qs.set('packageId', selectedPackage.id);
      else qs.set('durationMin', String(effectiveDuration));
      setAvailLoading(true);
      const res = await api<AvailabilityResponse>(`/api/v1/availability?${qs}`, { signal });
      if (res.ok) {
        setAvailability(res.data);
        setAvailError(null);
      } else if (res.error.code !== 'ABORTED') {
        setAvailability(null);
        setAvailError(res.error.message);
      }
      setAvailLoading(false);
    },
    [service, locationId, month, today, selectedPackage, effectiveDuration],
  );

  useEffect(() => {
    if (step < 1) return;
    const ctrl = new AbortController();
    loadAvailability(ctrl.signal);
    return () => ctrl.abort();
  }, [step, loadAvailability]);

  const calendarDays = useMemo(() => {
    const out: Record<string, CalendarDay> = {};
    for (const d of availability?.days ?? []) out[d.date] = { date: d.date, isOpen: d.isOpen, slotCount: d.slots.length };
    return out;
  }, [availability]);
  const daySlots = useMemo(() => availability?.days.find((d) => d.date === date)?.slots ?? [], [availability, date]);

  // If the chosen slot disappears after a refresh, clear it.
  useEffect(() => {
    if (startTime && availability && date && !daySlots.some((s) => s.startTime === startTime)) setStartTime(null);
  }, [availability, date, daySlots, startTime]);

  const maxMonth = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + site.bookingRules.maxAdvanceDays);
    return d.toISOString().slice(0, 7);
  }, [today, site.bookingRules.maxAdvanceDays]);

  const goTo = (n: number) => {
    setStep(n);
    setSubmitError(null);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  function validateStep(n: number): boolean {
    const e: Record<string, string> = {};
    if (n === 0) {
      if (!service) e.service = 'Choose a service.';
      if (usesPackages && !selectedPackage) e.package = 'Choose a package.';
      if (quoteError) e.service = quoteError;
    }
    if (n === 1) {
      if (!locationId) e.location = 'Choose a location.';
      if (!date) e.date = 'Choose a date.';
      else if (!startTime) e.time = 'Choose a start time.';
    }
    if (n === 2) {
      const parsed = createBookingSchema.shape.contact.safeParse(contact);
      if (!parsed.success) for (const issue of parsed.error.issues) e[`contact.${issue.path.join('.')}`] ??= issue.message;
      if (attendees && (!/^\d+$/.test(attendees) || Number(attendees) < 1)) e.attendees = 'Enter a whole number.';
    }
    if (n === 3 && !acceptTerms) e.acceptTerms = 'Please confirm you have read the booking terms.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validateStep(3) || !service || !locationId || !date || !startTime) return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await api<{ booking: BookingDto; accessToken: string }>('/api/v1/bookings', {
      body: {
        brand: (service as { brand?: string }).brand ?? brand,
        sourceSite,
        serviceId: service.id,
        packageId: selectedPackage?.id ?? null,
        addOnIds,
        locationId,
        date,
        startTime,
        durationMin: selectedPackage ? null : effectiveDuration,
        attendees: attendees ? Number(attendees) : null,
        contact: { name: contact.name, email: contact.email, phone: contact.phone || undefined },
        notes: notes || undefined,
        acceptTerms: true,
      },
    });
    setSubmitting(false);
    if (res.ok) {
      rememberAccessToken(res.data.booking.reference, res.data.accessToken);
      router.push(`/booking-status?ref=${encodeURIComponent(res.data.booking.reference)}&new=1`);
      return;
    }
    setSubmitError(res.error);
    const fe = fieldErrors(res.error);
    if (Object.keys(fe).length) setErrors(fe);
    if (res.error.code === 'UNAVAILABLE') {
      setStartTime(null);
      goTo(1);
    }
  }

  const location = serviceLocations.find((l) => l.id === locationId) ?? null;
  const isRequest = service?.bookingMode === 'REQUEST';

  return (
    <div className="booking-layout">
      <div>
        <ol className="steps" aria-label="Booking steps">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? 'step' : undefined} data-done={i < step}>
              {label}
            </li>
          ))}
        </ol>

        <h2 ref={headingRef} tabIndex={-1} style={{ fontSize: 'var(--step-2)', outline: 'none' }}>
          {['Choose your service', 'Pick a date and time', 'Your details', 'Review and submit'][step]}
        </h2>

        {submitError && (
          <div className="alert alert--danger" role="alert" style={{ marginBottom: 'var(--space-5)' }}>
            <strong>We could not complete your booking</strong>
            <p>{submitError.message}</p>
          </div>
        )}

        {step === 0 && (
          <div className="stack-lg">
            <fieldset>
              <legend className="label" style={{ marginBottom: 'var(--space-3)' }}>Service</legend>
              <div className="options options--2">
                {services.map((s) => (
                  <label key={s.id} className="option">
                    <input
                      type="radio"
                      name="service"
                      value={s.id}
                      checked={serviceId === s.id}
                      onChange={() => {
                        setServiceId(s.id);
                        setPackageId(s.packages.find((p) => p.isFeatured)?.id ?? s.packages[0]?.id ?? null);
                        setDurationMin(s.defaultDurationMin);
                        setAddOnIds([]);
                        setDate(null);
                        setStartTime(null);
                      }}
                    />
                    <span className="option__title">
                      <span>{s.name}</span>
                    </span>
                    <span className="option__meta">{priceFrom(s)}{s.bookingMode === 'REQUEST' ? ' · reviewed by the team' : ''}</span>
                  </label>
                ))}
              </div>
              {errors.service && <p className="field-error" role="alert">{errors.service}</p>}
            </fieldset>

            {service && usesPackages && (
              <fieldset>
                <legend className="label" style={{ marginBottom: 'var(--space-3)' }}>Package</legend>
                <div className="options options--2">
                  {service.packages.map((p) => (
                    <label key={p.id} className="option">
                      <input type="radio" name="package" value={p.id} checked={packageId === p.id} onChange={() => { setPackageId(p.id); setDate(null); setStartTime(null); }} />
                      <span className="option__title">
                        <span>{p.name}</span>
                        <span className="price">{formatMoney(p.priceMinor)}</span>
                      </span>
                      <span className="option__meta">{formatDuration(p.durationMin)} · {p.includes.join(' · ')}</span>
                    </label>
                  ))}
                </div>
                {errors.package && <p className="field-error">{errors.package}</p>}
              </fieldset>
            )}

            {service && !usesPackages && durationOptions.length > 1 && (
              <div className="field">
                <label htmlFor="duration">Duration</label>
                <select id="duration" className="select" value={effectiveDuration} onChange={(e) => { setDurationMin(Number(e.target.value)); setStartTime(null); }}>
                  {durationOptions.map((d) => (
                    <option key={d} value={d}>
                      {formatDuration(d)}
                      {service.pricingModel === 'HOURLY' ? ` · ${formatMoney(Math.round((service.hourlyRateMinor * d) / 60))}` : ''}
                    </option>
                  ))}
                </select>
                <p className="hint">{service.pricingModel === 'HOURLY' ? 'Billed by the hour for the time you book.' : 'Fixed price for the session.'}</p>
              </div>
            )}

            {service && service.addOns.length > 0 && (
              <fieldset>
                <legend className="label" style={{ marginBottom: 'var(--space-3)' }}>Optional add-ons</legend>
                <div className="stack">
                  {service.addOns.map((a) => (
                    <label key={a.id} className="checkbox">
                      <input
                        type="checkbox"
                        checked={addOnIds.includes(a.id)}
                        onChange={(e) => setAddOnIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                      />
                      <span>
                        {a.name} <span className="muted">· {formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? ' per hour' : ''}</span>
                        {a.description && <span className="muted small" style={{ display: 'block' }}>{a.description}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="cluster">
              <button type="button" className="btn" onClick={() => validateStep(0) && goTo(1)} disabled={!service}>
                Continue to date &amp; time
              </button>
            </div>
          </div>
        )}

        {step === 1 && service && (
          <div className="stack-lg">
            <div className="field">
              <label htmlFor="location">{labels.location ?? 'Location'}</label>
              <select id="location" className="select" value={locationId ?? ''} onChange={(e) => { setLocationId(e.target.value); setDate(null); setStartTime(null); }} aria-invalid={!!errors.location}>
                {serviceLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · {l.city}
                  </option>
                ))}
              </select>
              {location?.isDemo && <p className="hint">Demonstration location. The real address will be added by the business.</p>}
            </div>

            {availability?.isDemoAvailability && (
              <p className="badge badge--demo" style={{ margin: 0 }}>Demonstration availability</p>
            )}
            {availError && <div className="alert alert--danger" role="alert">{availError}</div>}

            <Calendar
              month={month}
              days={calendarDays}
              selected={date}
              onSelect={(d) => { setDate(d); setStartTime(null); }}
              onMonthChange={(m) => setMonth(m)}
              minMonth={today.slice(0, 7)}
              maxMonth={maxMonth}
              loading={availLoading}
            />
            {errors.date && <p className="field-error">{errors.date}</p>}

            {date && (
              <fieldset>
                <legend className="label" style={{ marginBottom: 'var(--space-3)' }}>
                  Start times on {formatCalendarDate(date)} <span className="muted">({tz.replace('_', ' ')})</span>
                </legend>
                {daySlots.length ? (
                  <div className="slots">
                    {daySlots.map((s) => (
                      <button key={s.startTime} type="button" className="slot" aria-pressed={startTime === s.startTime} onClick={() => setStartTime(s.startTime)} aria-label={`${s.startTime} to ${s.endTime}`}>
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No times left on this day. Please choose another date.</p>
                )}
                {errors.time && <p className="field-error">{errors.time}</p>}
              </fieldset>
            )}
            <p className="small muted">
              Times are checked again on our server when you submit. Bookings open {site.bookingRules.leadTimeHours} hours ahead and up to {site.bookingRules.maxAdvanceDays} days in advance.
            </p>
            <div className="cluster">
              <button type="button" className="btn btn--ghost" onClick={() => goTo(0)}>Back</button>
              <button type="button" className="btn" onClick={() => validateStep(1) && goTo(2)}>Continue</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); if (validateStep(2)) goTo(3); }}>
            {!me && (
              <div className="alert alert--info">
                <p style={{ margin: 0 }}>
                  Booking as a guest. <a href={`/account?next=${encodeURIComponent('/book')}`}>Sign in</a> to keep all your bookings in one place.
                </p>
              </div>
            )}
            <div className="form-row form-row--2">
              <TextField id="name" label="Full name" autoComplete="name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} error={errors['contact.name']} required />
              <TextField id="email" label="Email" type="email" autoComplete="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} error={errors['contact.email']} required readOnly={!!me} hint={me ? 'From your account' : 'We send your booking details here.'} />
            </div>
            <div className="form-row form-row--2">
              <TextField id="phone" label="Phone (optional)" type="tel" autoComplete="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} error={errors['contact.phone']} />
              {showAttendees && (
                <TextField id="attendees" label={labels.attendees ?? 'Number of people (optional)'} inputMode="numeric" value={attendees} onChange={setAttendees} error={errors.attendees} />
              )}
            </div>
            <div className="field">
              <label htmlFor="notes">Additional requirements (optional)</label>
              <textarea id="notes" className="textarea" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder={labels.notesPlaceholder} />
            </div>
            <div className="cluster">
              <button type="button" className="btn btn--ghost" onClick={() => goTo(1)}>Back</button>
              <button type="submit" className="btn">Review booking</button>
            </div>
          </form>
        )}

        {step === 3 && service && (
          <div className="stack-lg">
            <dl className="dl">
              <dt>Service</dt>
              <dd>{service.name}{selectedPackage ? ` · ${selectedPackage.name}` : ''}</dd>
              <dt>When</dt>
              <dd>{date && formatCalendarDate(date)} at {startTime} ({formatDuration(effectiveDuration)})</dd>
              <dt>{labels.location ?? 'Location'}</dt>
              <dd>{location?.name}</dd>
              <dt>Contact</dt>
              <dd>{contact.name} · {contact.email}{contact.phone ? ` · ${contact.phone}` : ''}</dd>
              {notes && (<><dt>Notes</dt><dd>{notes}</dd></>)}
            </dl>
            <div className="alert alert--info">
              <strong>What happens next</strong>
              {isRequest ? (
                <p>This service is reviewed by the team. We hold the slot while we review your request; payment is only requested once it is approved. Your booking is not confirmed yet.</p>
              ) : quote && quote.depositMinor > 0 && site.integrations.paymentsMode !== 'disabled' ? (
                <p>
                  We hold this slot for {site.bookingRules.holdMinutes} minutes while you pay the deposit of {formatMoney(quote.depositMinor)}. The booking is confirmed only after the payment is verified.
                  {site.integrations.paymentsSimulated ? ' In this demo, payment is simulated and no money is taken.' : ''}
                </p>
              ) : (
                <p>The team will review and confirm your booking.</p>
              )}
            </div>
            <div className="card card--surface small">
              <p style={{ marginBottom: 'var(--space-2)' }}><strong>Cancellation policy</strong>{site.cancellationPolicy.isSample && <span className="badge badge--demo" style={{ marginLeft: 8 }}>Sample</span>}</p>
              <p className="muted" style={{ margin: 0 }}>{site.cancellationPolicy.text}</p>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} aria-invalid={!!errors.acceptTerms} />
              <span>I have read the booking terms, cancellation policy and <a href="/privacy" target="_blank">privacy notice</a>.</span>
            </label>
            {errors.acceptTerms && <p className="field-error">{errors.acceptTerms}</p>}
            <div className="cluster">
              <button type="button" className="btn btn--ghost" onClick={() => goTo(2)}>Back</button>
              <button type="button" className="btn" onClick={submit} disabled={submitting}>
                {submitting ? <><span className="spinner" aria-hidden="true" /> Checking availability…</> : isRequest ? 'Submit request' : 'Reserve and continue to payment'}
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="booking-summary card" aria-label="Booking summary">
        <p className="eyebrow">Summary</p>
        {service ? (
          <div className="stack">
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--step-1)' }}>{service.name}</p>
            {selectedPackage && <p className="muted small" style={{ margin: 0 }}>{selectedPackage.name} package</p>}
            <p className="small" style={{ margin: 0 }}>
              {formatDuration(effectiveDuration)}
              {date && <> · {formatCalendarDate(date, { day: 'numeric', month: 'short' })}</>}
              {startTime && <> · {startTime}</>}
            </p>
            {location && <p className="small muted" style={{ margin: 0 }}>{location.name}</p>}
            <hr style={{ margin: 'var(--space-3) 0' }} />
            {quote ? (
              <PriceBreakdown lines={quote.lines} totalMinor={quote.totalMinor} depositMinor={isRequest ? undefined : quote.depositMinor} currency={quote.currency} isSample={site.pricing.isSample} />
            ) : quoteError ? (
              <p className="field-error">{quoteError}</p>
            ) : (
              <p className="muted small"><span className="spinner" aria-hidden="true" /> Calculating price…</p>
            )}
          </div>
        ) : (
          <p className="muted">Choose a service to see an itemised price.</p>
        )}
      </aside>
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  required,
  autoComplete,
  inputMode,
  readOnly,
  min,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text' | 'email' | 'tel' | 'decimal';
  readOnly?: boolean;
  min?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        readOnly={readOnly}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
      />
      {hint && <p className="hint" id={hintId}>{hint}</p>}
      {error && <p className="field-error" id={errId}>{error}</p>}
    </div>
  );
}
