'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, newIdempotencyKey, recallAccessToken, rememberAccessToken, type ApiErrorBody } from '../lib/api';
import { formatDateTime, formatDuration, formatMoney, formatTime } from '../lib/format';
import type { BookingDto, Brand, SiteConfig } from '../lib/types';
import { PriceBreakdown } from './PriceBreakdown';
import { TextField } from './BookingFlow';

interface LookupSummary {
  reference: string;
  brand: Brand;
  status: string;
  paymentStatus: string;
  serviceName: string;
  startsAt: string;
  timezone: string;
  isDemo: boolean;
}

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: 'success',
  COMPLETED: 'success',
  IN_PROGRESS: 'success',
  AWAITING_PAYMENT: 'warning',
  PAYMENT_PENDING: 'warning',
  ENQUIRY_SUBMITTED: 'warning',
  AWAITING_REVIEW: 'warning',
  CANCELLATION_REQUESTED: 'warning',
  CANCELLED: 'danger',
  REJECTED: 'danger',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = STATUS_TONE[status];
  return <span className={`badge ${tone ? `badge--${tone}` : ''}`}>{label}</span>;
}

export function BookingStatusView({ site, brandSites, initialRef, initialToken, isNew, signedIn }: {
  site: SiteConfig;
  brandSites: Record<Brand, string>;
  initialRef?: string;
  initialToken?: string;
  isNew?: boolean;
  signedIn: boolean;
}) {
  const [ref, setRef] = useState(initialRef?.toUpperCase() ?? '');
  const [token, setToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [loading, setLoading] = useState(!!initialRef);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Move any token from the URL into this browser's storage, then strip it from the address bar.
  useEffect(() => {
    if (!initialRef) return;
    let t = initialToken ?? null;
    // Strip the one-time token and "new" flag so a reload or shared URL carries neither.
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('new');
    window.history.replaceState(null, '', url.toString());
    if (t) {
      rememberAccessToken(initialRef, t);
    } else {
      t = recallAccessToken(initialRef);
    }
    setToken(t);
    if (!t && !signedIn) {
      setLoading(false);
      return;
    }
    (async () => {
      const res = await api<BookingDto>(`/api/v1/bookings/${encodeURIComponent(initialRef)}`, { headers: t ? { 'X-Booking-Token': t } : {} });
      if (res.ok) setBooking(res.data);
      else setLoadError(res.status === 404 ? 'We could not open this booking from this browser. Look it up with your email below, use the link in your confirmation message, or sign in.' : res.error.message);
      setLoading(false);
    })();
  }, [initialRef, initialToken, signedIn]);

  const refresh = useCallback(async () => {
    if (!booking) return;
    const res = await api<BookingDto>(`/api/v1/bookings/${booking.reference}`, { headers: token ? { 'X-Booking-Token': token } : {} });
    if (res.ok) setBooking(res.data);
  }, [booking, token]);

  if (loading) {
    return <p className="muted"><span className="spinner" aria-hidden="true" /> Loading your booking…</p>;
  }
  if (booking) {
    return <BookingDetail booking={booking} setBooking={setBooking} token={token} site={site} brandSites={brandSites} isNew={isNew} refresh={refresh} />;
  }
  return <LookupForm initialRef={ref} onRef={setRef} loadError={loadError} />;
}

function LookupForm({ initialRef, onRef, loadError }: { initialRef: string; onRef: (r: string) => void; loadError: string | null }) {
  const [reference, setReference] = useState(initialRef);
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<LookupSummary | null>(null);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<LookupSummary>('/api/v1/bookings/lookup', { body: { reference, email } });
    setBusy(false);
    if (res.ok) {
      setResult(res.data);
      onRef(res.data.reference);
    } else {
      setResult(null);
      setError(res.status === 404 ? { code: 'NOT_FOUND', message: 'No booking matches that reference and email address.' } : res.error);
    }
  }

  return (
    <div className="stack-lg">
      {loadError && <div className="alert alert--warning" role="status">{loadError}</div>}
      <form className="form card" onSubmit={submit} noValidate>
        <div className="form-row form-row--2">
          <TextField id="reference" label="Booking reference" value={reference} onChange={(v) => setReference(v.toUpperCase())} hint="For example PH-7K3Q9XMR" required />
          <TextField id="lookup-email" label="Email used for the booking" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        </div>
        {error && <p className="field-error" role="alert">{error.message}</p>}
        <div>
          <button className="btn" type="submit" disabled={busy || !reference || !email}>{busy ? 'Checking…' : 'Check status'}</button>
        </div>
      </form>
      {result && (
        <div className="card" role="status" aria-live="polite">
          <p className="eyebrow">Booking {result.reference}</p>
          <h2 style={{ fontSize: 'var(--step-2)' }}>{result.serviceName}</h2>
          <p>
            <StatusBadge status={result.status} label={result.status.replace(/_/g, ' ').toLowerCase()} /> <span className="muted">· {formatDateTime(result.startsAt, result.timezone)}</span>
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            For your privacy, full details and payment are only available through the secure link in your confirmation message or by signing in to the account used for the booking.
          </p>
        </div>
      )}
    </div>
  );
}

function BookingDetail({ booking, setBooking, token, site, brandSites, isNew, refresh }: {
  booking: BookingDto;
  setBooking: (b: BookingDto) => void;
  token: string | null;
  site: SiteConfig;
  brandSites: Record<Brand, string>;
  isNew?: boolean;
  refresh: () => Promise<void>;
}) {
  const tz = booking.timezone;
  const otherSite = booking.brand !== site.brand;
  const headers: Record<string, string> = token ? { 'X-Booking-Token': token } : {};
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  async function cancel() {
    setCancelBusy(true);
    const res = await api<BookingDto>(`/api/v1/bookings/${booking.reference}/cancel`, { body: { reason: reason || undefined }, headers });
    setCancelBusy(false);
    if (res.ok) {
      setBooking(res.data);
      setCancelOpen(false);
    } else setCancelError(res.error.message);
  }

  return (
    <div className="booking-layout">
      <div className="stack-lg">
        {isNew && (
          <div className="alert alert--success" role="status">
            <strong>{booking.status === 'ENQUIRY_SUBMITTED' ? 'Request received' : 'Slot reserved'}</strong>
            <p>
              Your reference is <span className="mono">{booking.reference}</span>. {booking.statusDescription} Keep this page or the link in your confirmation message to come back later.
            </p>
          </div>
        )}
        {otherSite && (
          <div className="alert alert--info">This booking belongs to our sister website. <a href={`${brandSites[booking.brand]}/booking-status?ref=${booking.reference}`}>Open it there</a>.</div>
        )}
        <div>
          <p className="eyebrow">Booking {booking.reference} {booking.isDemo && <span className="badge badge--demo">Demo record</span>}</p>
          <h2 style={{ fontSize: 'var(--step-3)' }}>{booking.service.name}{booking.package ? `: ${booking.package.name}` : ''}</h2>
          <p className="cluster">
            <StatusBadge status={booking.status} label={booking.statusLabel} />
            <span className="badge">{booking.paymentStatusLabel}</span>
          </p>
          <p className="muted">{booking.statusDescription}</p>
          {booking.holdExpiresAt && (booking.status === 'AWAITING_PAYMENT' || booking.status === 'PAYMENT_PENDING') && (
            <p className="small">Slot held until <strong>{formatTime(booking.holdExpiresAt, tz)}</strong> ({tz}). After that it is released automatically.</p>
          )}
        </div>

        <dl className="dl">
          <dt>Date &amp; time</dt>
          <dd>{formatDateTime(booking.startsAt, tz)} to {formatTime(booking.endsAt, tz)} <span className="muted small">({tz})</span></dd>
          <dt>Duration</dt>
          <dd>{formatDuration(booking.durationMin)}</dd>
          <dt>Location</dt>
          <dd>
            {booking.location.name}
            <br />
            <span className="muted small">{booking.location.addressLine1}, {booking.location.city}{booking.location.isDemo ? ' (demonstration location)' : ''}</span>
          </dd>
          <dt>Contact</dt>
          <dd>{booking.contact.name} · {booking.contact.email}</dd>
          {booking.customerNotes && (<><dt>Your notes</dt><dd>{booking.customerNotes}</dd></>)}
          {booking.cancellationReason && (<><dt>Reason</dt><dd>{booking.cancellationReason}</dd></>)}
        </dl>

        {(booking.actions.canPayDeposit || booking.actions.canPayBalance) && (
          <CheckoutPanel booking={booking} site={site} headers={headers} onUpdated={setBooking} refresh={refresh} />
        )}

        {booking.payments.length > 0 && (
          <section aria-labelledby="payments-h">
            <h3 id="payments-h">Payments</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody>
                  {booking.payments.map((p, i) => (
                    <tr key={i}>
                      <td>{formatDateTime(p.at, tz)}</td>
                      <td>{p.type === 'CHARGE' ? 'Payment' : 'Refund'} {p.isSimulated && <span className="badge badge--demo">Simulated</span>}</td>
                      <td>{p.status.toLowerCase()}</td>
                      <td className="price">{formatMoney(p.amountMinor, booking.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section aria-labelledby="history-h">
          <h3 id="history-h">History</h3>
          <ol className="timeline">
            {booking.history.map((h, i) => (
              <li key={i}>
                <strong>{h.label}</strong> <span className="muted small">· {formatDateTime(h.at, tz)}</span>
                {h.reason && <div className="small muted">{h.reason}</div>}
              </li>
            ))}
          </ol>
        </section>

        {(booking.actions.canCancel || booking.actions.canRequestCancellation) && (
          <section className="card card--surface" aria-labelledby="cancel-h">
            <h3 id="cancel-h">{booking.actions.canCancel ? 'Cancel this booking' : 'Request a cancellation'}</h3>
            <p className="small muted">{site.cancellationPolicy.text}</p>
            {!cancelOpen ? (
              <button type="button" className="btn btn--danger btn--sm" onClick={() => setCancelOpen(true)}>
                {booking.actions.canCancel ? 'Cancel booking' : 'Request cancellation'}
              </button>
            ) : (
              <div className="stack">
                <div className="field">
                  <label htmlFor="cancel-reason">Reason (optional)</label>
                  <textarea id="cancel-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                </div>
                {cancelError && <p className="field-error" role="alert">{cancelError}</p>}
                <div className="cluster">
                  <button type="button" className="btn btn--danger btn--sm" onClick={cancel} disabled={cancelBusy}>{cancelBusy ? 'Submitting…' : 'Confirm'}</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCancelOpen(false)}>Keep booking</button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="booking-summary card" aria-label="Price breakdown">
        <p className="eyebrow">Price</p>
        <PriceBreakdown lines={booking.items} totalMinor={booking.totalMinor} depositMinor={booking.depositMinor} amountPaidMinor={booking.amountPaidMinor} currency={booking.currency} isSample={site.pricing.isSample} />
        {booking.balanceDueMinor > 0 && booking.amountPaidMinor > 0 && (
          <p className="small" style={{ marginTop: 'var(--space-3)' }}>Balance remaining: <strong className="price">{formatMoney(booking.balanceDueMinor, booking.currency)}</strong></p>
        )}
      </aside>
    </div>
  );
}

interface CheckoutResponse {
  orderId: string;
  status: string;
  checkout:
    | { provider: 'DEMO'; isSimulated: true; orderId: string; amountMinor: number; currency: string }
    | { provider: 'RAZORPAY'; isSimulated: false; orderId: string; providerOrderId: string; keyId: string; amountMinor: number; currency: string; merchantName: string; prefill: { name: string; email: string; contact?: string } };
}

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function CheckoutPanel({ booking, site, headers, onUpdated, refresh }: {
  booking: BookingDto;
  site: SiteConfig;
  headers: Record<string, string>;
  onUpdated: (b: BookingDto) => void;
  refresh: () => Promise<void>;
}) {
  const purposes: { purpose: 'DEPOSIT' | 'FULL' | 'BALANCE'; label: string; amount: number }[] = [];
  const outstanding = booking.totalMinor - booking.amountPaidMinor;
  if (booking.actions.canPayDeposit) {
    purposes.push({ purpose: 'DEPOSIT', label: 'Pay deposit', amount: booking.depositMinor - booking.amountPaidMinor });
    if (booking.depositMinor < booking.totalMinor) purposes.push({ purpose: 'FULL', label: 'Pay in full', amount: outstanding });
  } else if (booking.actions.canPayBalance && booking.status === 'CONFIRMED') {
    purposes.push({ purpose: 'BALANCE', label: 'Pay balance', amount: outstanding });
  }
  const [demo, setDemo] = useState<{ orderId: string; amount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'warning' | 'success' | 'info'; text: string } | null>(null);
  const keyRef = useRef<Record<string, string>>({});

  if (site.integrations.paymentsMode === 'disabled') {
    return <div className="alert alert--info">Online payment is not enabled yet. The team will contact you to arrange payment.</div>;
  }

  async function start(purpose: 'DEPOSIT' | 'FULL' | 'BALANCE') {
    setBusy(true);
    setMessage(null);
    keyRef.current[purpose] ??= newIdempotencyKey();
    const res = await api<CheckoutResponse>(`/api/v1/bookings/${booking.reference}/payments`, {
      body: { purpose },
      headers: { ...headers, 'Idempotency-Key': keyRef.current[purpose]! },
    });
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: 'danger', text: res.error.message });
      return;
    }
    const c = res.data.checkout;
    if (c.provider === 'DEMO') {
      setDemo({ orderId: c.orderId, amount: c.amountMinor });
      await refresh();
      return;
    }
    const ok = await loadRazorpay();
    if (!ok || !window.Razorpay) {
      setMessage({ tone: 'danger', text: 'The payment window could not be loaded. Please check your connection and try again.' });
      return;
    }
    const rzp = new window.Razorpay({
      key: c.keyId,
      amount: c.amountMinor,
      currency: c.currency,
      name: c.merchantName,
      order_id: c.providerOrderId,
      prefill: c.prefill,
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        setMessage({ tone: 'info', text: 'Verifying your payment with the provider…' });
        const v = await api<{ orderStatus: string; booking: BookingDto }>(`/api/v1/payments/razorpay/${c.orderId}/confirm`, { body: resp, headers });
        if (v.ok) {
          onUpdated(v.data.booking);
          setMessage(
            v.data.orderStatus === 'SUCCEEDED'
              ? { tone: 'success', text: 'Payment verified.' }
              : { tone: 'warning', text: 'Your payment is still being verified by the provider. This page will show the result once it is confirmed.' },
          );
        } else setMessage({ tone: 'danger', text: v.error.message });
      },
      modal: { ondismiss: () => setMessage({ tone: 'warning', text: 'Payment window closed. You can try again while the slot is held.' }) },
    });
    rzp.open();
  }

  async function simulate(outcome: 'success' | 'failure') {
    if (!demo) return;
    setBusy(true);
    const res = await api<{ orderStatus: string; booking: BookingDto }>(`/api/v1/payments/demo/${demo.orderId}/simulate`, { body: { outcome }, headers });
    setBusy(false);
    if (res.ok) {
      onUpdated(res.data.booking);
      setDemo(null);
      keyRef.current = {};
      setMessage(
        res.data.orderStatus === 'SUCCEEDED'
          ? { tone: 'success', text: 'Simulated payment recorded. No money was taken.' }
          : { tone: 'warning', text: 'Simulated payment failure recorded. You can try again.' },
      );
    } else setMessage({ tone: 'danger', text: res.error.message });
  }

  return (
    <section className="card" aria-labelledby="pay-h">
      <h3 id="pay-h">Payment</h3>
      {site.integrations.paymentsSimulated && (
        <div className="alert alert--warning" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>Demo payment mode</strong>
          <p>Payments on this demonstration site are simulated. No card details are collected and no money is taken.</p>
        </div>
      )}
      {message && <div className={`alert alert--${message.tone}`} role="status" style={{ marginBottom: 'var(--space-4)' }}>{message.text}</div>}
      {!demo ? (
        <div className="cluster">
          {purposes.map((p) => (
            <button key={p.purpose} type="button" className={p.purpose === 'FULL' ? 'btn btn--ghost' : 'btn'} disabled={busy} onClick={() => start(p.purpose)}>
              {p.label} · {formatMoney(p.amount, booking.currency)}
            </button>
          ))}
        </div>
      ) : (
        <div className="stack" role="dialog" aria-labelledby="demo-h">
          <p id="demo-h" style={{ margin: 0 }}>
            <strong>Simulated checkout</strong> for <span className="price">{formatMoney(demo.amount, booking.currency)}</span>
          </p>
          <p className="small muted" style={{ margin: 0 }}>Choose the outcome the demo payment provider should report. The booking only changes after the server records the result.</p>
          <div className="cluster">
            <button type="button" className="btn" onClick={() => simulate('success')} disabled={busy}>Simulate successful payment</button>
            <button type="button" className="btn btn--danger" onClick={() => simulate('failure')} disabled={busy}>Simulate failed payment</button>
            <button type="button" className="btn btn--ghost" onClick={() => setDemo(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
