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

export function BookingStatusView({ site, brandSites, initialRef, initialToken, isNew, signedIn, homeBrands, showReceipt }: {
  /** Brands whose bookings this site can show (defaults to the site's own brand). */
  homeBrands?: Brand[];
  /** Show a link to the printable receipt page (/receipt/[ref]). */
  showReceipt?: boolean;
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
    return <BookingDetail booking={booking} setBooking={setBooking} token={token} site={site} brandSites={brandSites} isNew={isNew} refresh={refresh} homeBrands={homeBrands ?? [site.brand]} showReceipt={!!showReceipt} />;
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

function BookingDetail({ booking, setBooking, token, site, brandSites, isNew, refresh, homeBrands, showReceipt }: {
  homeBrands: Brand[];
  showReceipt: boolean;
  booking: BookingDto;
  setBooking: (b: BookingDto) => void;
  token: string | null;
  site: SiteConfig;
  brandSites: Record<Brand, string>;
  isNew?: boolean;
  refresh: () => Promise<void>;
}) {
  const tz = booking.timezone;
  const otherSite = !homeBrands.includes(booking.brand);
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
            <p className="small cluster">
              <HoldCountdown until={booking.holdExpiresAt} onExpire={refresh} />
              <span>Slot held until <strong>{formatTime(booking.holdExpiresAt, tz)}</strong> ({tz}). After that it is released automatically.</span>
            </p>
          )}
          {showReceipt && booking.actions.hasTicket && (
            <p><a className="btn btn--sm" href={`/ticket/${booking.reference}`}>View e-ticket</a>{booking.checkedInAt && <span className="badge badge--success" style={{ marginLeft: 8 }}>Checked in</span>}</p>
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
                      <td>{p.type === 'CHARGE' ? 'Payment' : 'Refund'} {p.isSimulated && <span className="badge badge--demo">{site.integrations.paymentsTestMode ? 'Test mode' : 'Simulated'}</span>}</td>
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

        {showReceipt && booking.payments.length > 0 && (
          <p><a className="link-arrow" href={`/receipt/${booking.reference}`}>View receipt</a></p>
        )}

        {(booking.actions.canReview || booking.review) && (
          <ReviewSection booking={booking} headers={headers} onDone={refresh} />
        )}

        {(booking.rescheduleRequests?.length || booking.actions.canRequestReschedule) && (
          <RescheduleSection booking={booking} headers={headers} onDone={refresh} />
        )}

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
  const [checking, setChecking] = useState(false);
  const provider = site.integrations.paymentsMode === 'live';

  // If a checkout was started but the browser never came back (closed tab, lost
  // connection), ask the server to check the outcome with the provider.
  const syncWithProvider = useCallback(async (announce: boolean) => {
    setChecking(true);
    const res = await api<{ recorded: number; booking: BookingDto }>(`/api/v1/bookings/${booking.reference}/payments/sync`, { body: {}, headers });
    setChecking(false);
    if (res.ok) {
      onUpdated(res.data.booking);
      if (res.data.recorded > 0) setMessage({ tone: 'success', text: 'Payment confirmed with the provider.' });
      else if (announce) setMessage({ tone: 'info', text: 'No completed payment found yet. If you just paid, wait a moment and check again.' });
    } else if (announce) setMessage({ tone: 'danger', text: res.error.message });
  }, [booking.reference, headers, onUpdated]);

  const pendingAtProvider = provider && booking.paymentStatus === 'PENDING';
  useEffect(() => {
    if (pendingAtProvider) void syncWithProvider(false);
    // Run once per page load for this booking.
  }, [booking.reference]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // A failed attempt is not resumable: the next click starts a fresh one.
      delete keyRef.current[purpose];
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
      modal: {
        ondismiss: () => {
          setMessage({ tone: 'warning', text: 'Payment window closed. You can try again while the slot is held.' });
          void syncWithProvider(false);
        },
      },
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
      {site.integrations.paymentsTestMode && (
        <div className="alert alert--warning" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>Razorpay test mode</strong>
          <p>Payments go through Razorpay&rsquo;s real checkout in test mode. No money is taken. Use Razorpay&rsquo;s test card 5267 3181 8797 5449 (any future expiry, any CVV), or Netbanking with any bank and choose <em>Success</em> on the test bank page.</p>
        </div>
      )}
      {message && <div className={`alert alert--${message.tone}`} role="status" style={{ marginBottom: 'var(--space-4)' }}>{message.text}</div>}
      {pendingAtProvider && (
        <p className="small" style={{ marginBottom: 'var(--space-3)' }}>
          Already completed a payment?{' '}
          <button type="button" className="btn btn--ghost btn--sm" disabled={checking} onClick={() => syncWithProvider(true)}>{checking ? 'Checking…' : 'Check payment status'}</button>
        </p>
      )}
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

/** Live countdown for a payment hold (BookMyShow-style). Refreshes the booking when it runs out. */
function HoldCountdown({ until, onExpire }: { until: string; onExpire: () => Promise<void> }) {
  const end = new Date(until).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => {
      const ms = Math.max(0, end - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(t);
        void onExpire();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [end]); // eslint-disable-line react-hooks/exhaustive-deps
  const mm = String(Math.floor(left / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0');
  return (
    <span className="st-countdown badge badge--warning" role="timer" aria-live="off" aria-label={`Time left to pay: ${mm} minutes ${ss} seconds`}>
      {left > 0 ? `Complete payment in ${mm}:${ss}` : 'Payment time has run out'}
    </span>
  );
}

/** Star rating and comment, available once the session has taken place. */
function ReviewSection({ booking, headers, onDone }: { booking: BookingDto; headers: Record<string, string>; onDone: () => Promise<void> }) {
  const existing = booking.review;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [open, setOpen] = useState(!existing);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (existing?.status === 'HIDDEN') {
    return <section className="card card--surface"><h3>Your review</h3><p className="small muted" style={{ margin: 0 }}>Your review was removed by the studio.</p></section>;
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!rating) {
      setMsg({ tone: 'danger', text: 'Choose a rating from 1 to 5 stars.' });
      return;
    }
    setBusy(true);
    const res = await api(`/api/v1/bookings/${booking.reference}/review`, { body: { rating, comment: comment || undefined }, headers });
    setBusy(false);
    if (res.ok) {
      setMsg({ tone: 'success', text: 'Thank you! Your review is now shown on the service page.' });
      setOpen(false);
      await onDone();
    } else setMsg({ tone: 'danger', text: res.error.message });
  }
  return (
    <section className="card card--surface" aria-labelledby="review-h">
      <h3 id="review-h">{existing ? 'Your review' : 'Rate your session'}</h3>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {!open && existing ? (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          <p style={{ margin: 0, color: 'var(--accent-text)', letterSpacing: 1 }} aria-label={`${existing.rating} out of 5 stars`}>{'★★★★★'.slice(0, existing.rating)}{'☆☆☆☆☆'.slice(0, 5 - existing.rating)}</p>
          {existing.comment && <p style={{ margin: 0 }}>{existing.comment}</p>}
          <div><button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>Edit review</button></div>
        </div>
      ) : (
        <form className="stack" onSubmit={save}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">Your rating</legend>
            <div className="st-star-input" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} className={n <= rating ? 'on' : undefined} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="rv-comment">Tell others about your experience (optional)</label>
            <textarea id="rv-comment" className="textarea" rows={3} maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>Your first name and last initial are shown with your review.</p>
          <div><button className="btn btn--sm" type="submit" disabled={busy}>{existing ? 'Update review' : 'Submit review'}</button></div>
        </form>
      )}
    </section>
  );
}

function RescheduleSection({ booking, headers, onDone }: { booking: BookingDto; headers: Record<string, string>; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = booking.rescheduleRequests?.find((r) => r.status === 'PENDING');
  const last = booking.rescheduleRequests?.[0];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await api(`/api/v1/bookings/${booking.reference}/reschedule-requests`, { body: { date, startTime: time, reason: reason || undefined }, headers });
    setBusy(false);
    if (res.ok) {
      setMsg({ tone: 'success', text: 'Request sent. Your current time stays reserved until the team confirms the change.' });
      setOpen(false);
      await onDone();
    } else setMsg({ tone: 'danger', text: res.error.message });
  }

  return (
    <section className="card card--surface" aria-labelledby="resched-h">
      <h3 id="resched-h">Change the date or time</h3>
      {msg && <div className={`alert alert--${msg.tone}`} role="status" style={{ marginBottom: 'var(--space-3)' }}>{msg.text}</div>}
      {pending ? (
        <p className="small">Request pending: <strong>{formatDateTime(pending.requestedStart, booking.timezone)}</strong>. Your current time stays reserved until the team confirms.</p>
      ) : last && last.status !== 'PENDING' ? (
        <p className="small muted">Last request {last.status.toLowerCase()}{last.decisionNote ? `: ${last.decisionNote}` : ''}.</p>
      ) : null}
      {booking.actions.canRequestReschedule && !open && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>Request a new time</button>
      )}
      {open && (
        <form className="stack" onSubmit={submit}>
          <div className="form-row form-row--2">
            <TextField id="rs-date" label="New date" type="date" value={date} onChange={setDate} required />
            <TextField id="rs-time" label={`Start time (${booking.timezone})`} type="time" value={time} onChange={setTime} required />
          </div>
          <div className="field">
            <label htmlFor="rs-reason">Reason (optional)</label>
            <textarea id="rs-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>We check the new time is free before sending your request. The team confirms the change.</p>
          <div className="cluster">
            <button className="btn btn--sm" type="submit" disabled={busy || !date || !time}>{busy ? 'Checking…' : 'Send request'}</button>
            <button className="btn btn--ghost btn--sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
