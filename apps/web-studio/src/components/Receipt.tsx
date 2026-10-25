'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, formatDateTime, formatMoney, recallAccessToken, type BookingDto } from '@studio/ui';

const PAYMENT_LABEL: Record<string, string> = { CHARGE: 'Payment', REFUND: 'Refund' };

/** Printable payment receipt built from the live booking record. Not a tax invoice. */
export function Receipt({ reference, token: urlToken, businessName }: { reference: string; token?: string; businessName: string }) {
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = urlToken ?? recallAccessToken(reference);
    api<BookingDto>(`/api/v1/bookings/${encodeURIComponent(reference)}`, { headers: token ? { 'X-Booking-Token': token } : {} }).then((r) => {
      if (r.ok) setBooking(r.data);
      else setError(r.status === 401 || r.status === 403 || r.status === 404 ? 'We could not open this receipt. Sign in, or open it from the browser you booked with.' : r.error.message);
    });
  }, [reference, urlToken]);

  if (error) return <div className="alert alert--warning">{error} <Link href={`/booking-status?ref=${reference}`}>Go to booking status</Link></div>;
  if (!booking) return <p className="muted"><span className="spinner" aria-hidden="true" /> Loading receipt…</p>;

  const paid = booking.payments.filter((p) => p.status === 'SUCCEEDED' && p.type === 'CHARGE');
  const anySimulated = booking.payments.some((p) => p.isSimulated);
  return (
    <article className="st-panel stack" aria-labelledby="receipt-title" style={{ maxWidth: 720, marginInline: 'auto' }}>
      <header className="cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 id="receipt-title" style={{ fontSize: 'var(--step-2)', margin: 0 }}>Payment receipt</h1>
          <p className="small muted" style={{ margin: 0 }}>{businessName}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="mono" style={{ margin: 0, fontWeight: 700 }}>{booking.reference}</p>
          <p className="small muted" style={{ margin: 0 }}>Status: {booking.statusLabel}</p>
        </div>
      </header>
      {(anySimulated || booking.isDemo) && <p className="alert alert--info small" style={{ margin: 0 }}>Demonstration record. {anySimulated ? 'Payments shown were simulated or made in Razorpay test mode; no money was taken.' : ''} This is not a tax invoice.</p>}
      <dl className="dl">
        <dt>Billed to</dt><dd>{booking.contact.name} · {booking.contact.email}</dd>
        <dt>Service</dt><dd>{booking.service.name}{booking.package ? ` · ${booking.package.name}` : ''}</dd>
        <dt>When</dt><dd>{formatDateTime(booking.startsAt, booking.timezone)}</dd>
        <dt>Where</dt><dd>{booking.location.name}, {booking.location.city}</dd>
      </dl>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th scope="col">Item</th><th scope="col" style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {booking.items.map((l, i) => <tr key={i}><td>{l.description}{l.quantity !== 1 ? ` × ${l.quantity}` : ''}</td><td style={{ textAlign: 'right' }}>{formatMoney(l.totalMinor, booking.currency)}</td></tr>)}
            {booking.discountMinor > 0 && <tr><td>Discount</td><td style={{ textAlign: 'right' }}>−{formatMoney(booking.discountMinor, booking.currency)}</td></tr>}
            {booking.feesMinor > 0 && <tr><td>Fees</td><td style={{ textAlign: 'right' }}>{formatMoney(booking.feesMinor, booking.currency)}</td></tr>}
            <tr><td>Tax</td><td style={{ textAlign: 'right' }}>{formatMoney(booking.taxMinor, booking.currency)}</td></tr>
            <tr><th scope="row">Total</th><th style={{ textAlign: 'right' }}>{formatMoney(booking.totalMinor, booking.currency)}</th></tr>
          </tbody>
        </table>
      </div>
      <div className="table-wrap">
        <table className="table">
          <caption className="small muted" style={{ textAlign: 'left' }}>Payments</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col" style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {booking.payments.length ? booking.payments.map((p, i) => (
              <tr key={i}><td>{formatDateTime(p.at, booking.timezone)}</td><td>{PAYMENT_LABEL[p.type] ?? p.type}{p.isSimulated ? ' (no real money)' : ''}</td><td>{p.status.toLowerCase()}</td><td style={{ textAlign: 'right' }}>{formatMoney(p.amountMinor, booking.currency)}</td></tr>
            )) : <tr><td colSpan={4} className="muted">No payments recorded.</td></tr>}
          </tbody>
        </table>
      </div>
      <dl className="dl">
        <dt>Paid</dt><dd>{formatMoney(booking.amountPaidMinor, booking.currency)}</dd>
        {booking.amountRefundedMinor > 0 && <><dt>Refunded</dt><dd>{formatMoney(booking.amountRefundedMinor, booking.currency)}</dd></>}
        <dt>Balance due</dt><dd>{formatMoney(booking.balanceDueMinor, booking.currency)}</dd>
      </dl>
      {paid.length === 0 && <p className="small muted" style={{ margin: 0 }}>No successful payment has been recorded yet.</p>}
      <div className="cluster no-print">
        <button type="button" className="btn btn--sm" onClick={() => window.print()}>Print or save as PDF</button>
        <Link className="btn btn--ghost btn--sm" href={`/booking-status?ref=${booking.reference}`}>Back to booking</Link>
      </div>
    </article>
  );
}
