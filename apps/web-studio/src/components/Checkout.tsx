'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fieldErrors, formatCalendarDate, formatDuration, formatMoney, rememberAccessToken, TextField, type Me, type SiteConfig } from '@studio/ui';
import type { StudioService } from '../lib/types';
import type { PublicOffer } from './OfferCard';

interface Line { kind: string; description: string; quantity: number; unitPriceMinor: number; totalMinor: number }
interface Quote {
  lines: Line[];
  subtotalMinor: number;
  discountMinor: number;
  feesMinor: number;
  taxMinor: number;
  taxLabel: string;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
  durationMin: number;
  offer: { code: string; title: string } | null;
}

/**
 * BookMyShow-style booking summary. The summary is always the server's quote;
 * the booking is created (and the slot held) only when the customer proceeds.
 */
export function Checkout({ service, location, date, time, packageId, durationMin, site, me, offers }: {
  service: StudioService;
  location: { id: string; name: string; addressLine1: string; city: string; timezone: string };
  date: string;
  time: string;
  packageId: string | null;
  durationMin: number | null;
  site: SiteConfig;
  me: Me | null;
  offers: PublicOffer[];
}) {
  const router = useRouter();
  const pkg = service.packages.find((p) => p.id === packageId) ?? null;
  const [addOns, setAddOns] = useState<string[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: me?.profile.fullName ?? '', email: me?.profile.email ?? '', phone: me?.profile.phone ?? '' });
  const [notes, setNotes] = useState('');
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRequest = service.bookingMode === 'REQUEST';

  const body = useMemo(
    () => ({ serviceId: service.id, packageId: pkg?.id ?? null, addOnIds: addOns, durationMin: pkg ? null : durationMin, locationId: location.id }),
    [service.id, pkg, addOns, durationMin, location.id],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const r = await api<Quote>('/api/v1/quotes', { body: { ...body, couponCode: coupon }, signal: ctrl.signal });
      if (r.ok) {
        setQuote(r.data);
        setQuoteError(null);
      } else if (r.error.code !== 'ABORTED') {
        if (coupon && fieldErrors(r.error).couponCode) {
          // The coupon stopped applying (e.g. an add-on change): drop it and re-price.
          setCouponError(fieldErrors(r.error).couponCode!);
          setCoupon(null);
        } else setQuoteError(r.error.message);
      }
    })();
    return () => ctrl.abort();
  }, [body, coupon]);

  async function applyCoupon(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setCouponError(null);
    const r = await api<Quote>('/api/v1/quotes', { body: { ...body, couponCode: c } });
    if (r.ok) {
      setCoupon(c);
      setCouponInput(c);
      setQuote(r.data);
    } else setCouponError(fieldErrors(r.error).couponCode ?? r.error.message);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (contact.name.trim().length < 2) errs['contact.name'] = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(contact.email.trim())) errs['contact.email'] = 'Enter a valid email address';
    if (!accept) errs.acceptTerms = 'Please accept the booking terms';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setSubmitError(null);
    const r = await api<{ booking: { reference: string }; accessToken: string }>('/api/v1/bookings', {
      body: {
        brand: service.brand,
        sourceSite: 'STUDIO',
        ...body,
        date,
        startTime: time,
        couponCode: coupon,
        contact: { name: contact.name, email: contact.email, phone: contact.phone || undefined },
        notes: notes || undefined,
        acceptTerms: true,
      },
    });
    if (!r.ok) {
      setBusy(false);
      setErrors(fieldErrors(r.error));
      setSubmitError(r.error.code === 'UNAVAILABLE' ? `${r.error.message}` : r.error.message);
      return;
    }
    rememberAccessToken(r.data.booking.reference, r.data.accessToken);
    router.push(`/booking-status?ref=${r.data.booking.reference}&new=1`);
  }

  const lines = quote?.lines ?? [];
  const items = lines.filter((l) => ['SERVICE', 'PACKAGE', 'ADDON'].includes(l.kind));
  const fees = lines.filter((l) => l.kind === 'FEE');
  const discount = lines.find((l) => l.kind === 'DISCOUNT');

  return (
    <form className="st-checkout" onSubmit={submit} noValidate>
      <div className="stack-lg" style={{ minWidth: 0 }}>
        <div>
          <h1 style={{ fontSize: 'var(--step-3)', marginBottom: 'var(--space-1)' }}>Booking summary</h1>
          <p className="muted" style={{ margin: 0 }}>Review your session, add extras and apply an offer. Nothing is reserved until you proceed.</p>
        </div>

        {service.addOns.length > 0 && (
          <section aria-labelledby="addons-h">
            <h2 id="addons-h" style={{ fontSize: '1.15rem' }}>Add extras to your session</h2>
            <div className="st-addons">
              {service.addOns.map((a) => {
                const on = addOns.includes(a.id);
                return (
                  <label key={a.id} className="st-addon" data-on={on}>
                    <span className="cluster" style={{ justifyContent: 'space-between' }}>
                      <strong>{a.name}</strong>
                      <input type="checkbox" checked={on} onChange={(e) => setAddOns((cur) => (e.target.checked ? [...cur, a.id] : cur.filter((x) => x !== a.id)))} />
                    </span>
                    {a.description && <span className="small muted">{a.description}</span>}
                    <span style={{ fontWeight: 600 }}>{formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? ' / hour' : ''}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="offer-h" className="st-panel stack">
          <h2 id="offer-h" style={{ fontSize: '1.15rem', margin: 0 }}>Apply an offer</h2>
          {coupon ? (
            <div className="cluster" style={{ justifyContent: 'space-between' }}>
              <span><span className="st-offer__code">{coupon}</span> <span className="small" style={{ color: 'var(--ok)' }}>applied: you save {formatMoney(quote?.discountMinor ?? 0)}</span></span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setCoupon(null); setCouponInput(''); }}>Remove</button>
            </div>
          ) : (
            <div className="cluster" style={{ alignItems: 'flex-start' }}>
              <div className="field" style={{ flex: 1, minWidth: 180, margin: 0 }}>
                <label htmlFor="coupon" className="visually-hidden">Coupon code</label>
                <input id="coupon" className="input" placeholder="Enter coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} aria-invalid={!!couponError} aria-describedby={couponError ? 'coupon-err' : undefined} autoComplete="off" />
              </div>
              <button type="button" className="btn" onClick={() => applyCoupon(couponInput)} disabled={!couponInput.trim()}>Apply</button>
            </div>
          )}
          {couponError && <p id="coupon-err" className="field-error" role="alert" style={{ margin: 0 }}>{couponError}</p>}
          {!coupon && offers.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
              {offers.map((o) => (
                <li key={o.id} className="cluster" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)' }}>
                  <span><span className="st-offer__code">{o.code}</span> <span className="small">{o.summary}</span>{o.isDemo && <span className="small muted"> (sample)</span>}</span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => applyCoupon(o.code)}>Apply<span className="visually-hidden"> {o.code}</span></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="contact-h" className="st-panel stack">
          <h2 id="contact-h" style={{ fontSize: '1.15rem', margin: 0 }}>Your details</h2>
          {!me && <p className="small muted" style={{ margin: 0 }}>Booking as a guest. <a href={`/account?next=${encodeURIComponent(typeof window === 'undefined' ? '/checkout' : window.location.pathname + window.location.search)}`}>Sign in</a> to keep your bookings and tickets in one place.</p>}
          <div className="form-row form-row--2">
            <TextField id="name" label="Full name" autoComplete="name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} error={errors['contact.name']} required />
            <TextField id="email" label="Email" type="email" autoComplete="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} error={errors['contact.email']} required readOnly={!!me} hint="Your e-ticket and confirmation are sent here." />
          </div>
          <TextField id="phone" label="Phone (optional)" type="tel" autoComplete="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} error={errors['contact.phone']} />
          <div className="field">
            <label htmlFor="notes">Notes for the studio (optional)</label>
            <textarea id="notes" className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brief, references, number of people…" />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} aria-invalid={!!errors.acceptTerms} />
            <span>I have read the <a href="/policies/terms" target="_blank">booking terms</a> and <a href="/policies/cancellation-refund" target="_blank">cancellation policy</a>.</span>
          </label>
          {errors.acceptTerms && <p className="field-error" style={{ margin: 0 }}>{errors.acceptTerms}</p>}
        </section>
      </div>

      <aside className="st-summary" aria-label="Order summary">
        <div className="st-summary__head">
          <p>Booking summary</p>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>{service.name}{pkg ? ` · ${pkg.name}` : ''}</h2>
          <div className="small">{formatCalendarDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {time} · {formatDuration(quote?.durationMin ?? pkg?.durationMin ?? durationMin ?? service.defaultDurationMin)}</div>
          <div className="small muted">{location.name}, {location.city}</div>
        </div>
        <div className="st-summary__lines" aria-live="polite">
          {quote ? (
            <>
              {items.map((l, i) => <div key={i}><span>{l.description}</span><span>{formatMoney(l.totalMinor)}</span></div>)}
              {discount && <div className="disc"><span>{discount.description}</span><span>−{formatMoney(-discount.totalMinor)}</span></div>}
              {fees.map((l, i) => <div key={`f${i}`}><span>{l.description}</span><span>{formatMoney(l.totalMinor)}</span></div>)}
              {quote.taxMinor > 0 && <div><span>{quote.taxLabel}</span><span>{formatMoney(quote.taxMinor)}</span></div>}
              {site.pricing.isSample && <p className="small muted" style={{ margin: 0 }}>Sample prices, tax and fee for the demo.</p>}
            </>
          ) : quoteError ? (
            <p className="field-error" style={{ margin: 0 }}>{quoteError}</p>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>Calculating your price…</p>
          )}
        </div>
        <div className="st-summary__total"><span>Amount payable</span><span>{quote ? formatMoney(quote.totalMinor) : '—'}</span></div>
        <div className="st-summary__pay stack">
          {quote && !isRequest && quote.depositMinor > 0 && quote.depositMinor < quote.totalMinor && (
            <p className="small" style={{ margin: 0 }}>Pay <strong>{formatMoney(quote.depositMinor)}</strong> now as a deposit to confirm; {formatMoney(quote.balanceMinor)} is due before the session.</p>
          )}
          {submitError && <div className="alert alert--danger small" role="alert">{submitError}</div>}
          <button type="submit" className="btn btn--block" disabled={busy || !quote}>
            {busy ? <><span className="spinner" aria-hidden="true" /> Reserving…</> : isRequest ? 'Send booking request' : `Proceed to pay ${quote ? formatMoney(quote.depositMinor > 0 ? quote.depositMinor : quote.totalMinor) : ''}`}
          </button>
          <p className="small muted" style={{ margin: 0 }}>
            {isRequest
              ? 'The team reviews requests before confirming. Nothing is charged now.'
              : `We hold this slot for ${site.bookingRules.holdMinutes} minutes while you pay. It is confirmed once the payment is verified.`}
          </p>
        </div>
      </aside>
    </form>
  );
}
