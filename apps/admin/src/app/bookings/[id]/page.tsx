'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { STATUS_LABELS, type BookingStatusValue } from '@studio/core/status';
import { formatDateTime, formatDuration, formatMoney, PriceBreakdown, StatusBadge } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Booking = any;

const ACTION_LABELS: Partial<Record<BookingStatusValue, string>> = {
  AWAITING_REVIEW: 'Start review',
  AWAITING_PAYMENT: 'Approve and request payment',
  CONFIRMED: 'Confirm',
  IN_PROGRESS: 'Mark in progress',
  COMPLETED: 'Mark completed',
  CANCELLATION_REQUESTED: 'Record cancellation request',
  CANCELLED: 'Cancel booking',
  REJECTED: 'Reject request',
};

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const { data: b, error, reload } = useAdminData<Booking>(`/api/v1/admin/bookings/${id}`);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [resched, setResched] = useState({ date: '', startTime: '', reason: '' });
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <div className="alert alert--danger">{error.message}</div>;
  if (!b) return <p className="muted">Loading…</p>;

  async function run(fn: () => Promise<{ ok: boolean; error?: any }>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setMsg({ tone: 'success', text: success });
      setReason('');
      await reload();
    } else setMsg({ tone: 'danger', text: errorText(res.error) ?? 'Failed' });
  }

  const unpaid = b.depositMinor > 0 && b.amountPaidMinor < b.depositMinor;
  return (
    <div className="stack-lg">
      <div>
        <p className="small"><Link href="/bookings">← Bookings</Link></p>
        <h1 className="mono" style={{ marginBottom: 'var(--space-2)' }}>{b.reference}</h1>
        <div className="cluster">
          <StatusBadge status={b.status} label={STATUS_LABELS[b.status as BookingStatusValue]} />
          <span className="badge">{b.paymentStatus.toLowerCase().replace('_', ' ')}</span>
          <span className="badge">{b.brand.toLowerCase()}</span>
          {b.isDemo && <span className="badge badge--demo">Demo record</span>}
        </div>
      </div>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}

      <div className="cols">
        <div>
          <section className="panel">
            <h2>Details</h2>
            <dl className="dl">
              <dt>Service</dt><dd>{b.service.name}{b.package ? ` · ${b.package.name}` : ''}</dd>
              <dt>When</dt><dd>{formatDateTime(b.startsAt, b.timezone)} – {formatDateTime(b.endsAt, b.timezone, { weekday: undefined, day: undefined, month: undefined, year: undefined })} ({formatDuration(b.durationMin)}, {b.timezone})</dd>
              <dt>Location</dt><dd>{b.location.name}</dd>
              <dt>Resource</dt><dd>{b.resource?.name ?? 'Not applicable'} <span className="small muted">(blocked until {formatDateTime(b.blockedUntil, b.timezone)} incl. turnaround)</span></dd>
              <dt>Customer</dt><dd><Link href={`/customers/${b.customer.id}`}>{b.contactName}</Link> · {b.contactEmail}{b.contactPhone ? ` · ${b.contactPhone}` : ''}</dd>
              {b.attendees && (<><dt>Attendees</dt><dd>{b.attendees}</dd></>)}
              {b.customerNotes && (<><dt>Customer notes</dt><dd>{b.customerNotes}</dd></>)}
              {b.holdExpiresAt && (<><dt>Hold expires</dt><dd>{formatDateTime(b.holdExpiresAt, b.timezone)}</dd></>)}
              {b.cancellationReason && (<><dt>Reason</dt><dd>{b.cancellationReason}</dd></>)}
              {b.enquiry && (<><dt>From enquiry</dt><dd><Link href={`/enquiries/${b.enquiry.id}`}>{b.enquiry.reference}</Link>{b.quotation ? ` · quotation ${b.quotation.reference} v${b.quotation.version}` : ''}</dd></>)}
              <dt>Created</dt><dd>{formatDateTime(b.createdAt, b.timezone)} · pricing {b.pricingVersion}</dd>
            </dl>
          </section>

          {can('bookings.manage') && b.allowedTransitions.length > 0 && (
            <section className="panel">
              <h2>Actions</h2>
              {unpaid && b.allowedTransitions.includes('CONFIRMED') && (
                <div className="alert alert--warning" style={{ marginBottom: 'var(--space-4)' }}>No verified deposit yet. Confirming now requires a reason (for example, offline payment received) and is recorded in the audit log.</div>
              )}
              <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
                <label htmlFor="reason">Reason / note for the customer (required to reject, cancel or confirm without payment)</label>
                <textarea id="reason" className="textarea" style={{ minHeight: 70 }} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </div>
              <div className="cluster">
                {(b.allowedTransitions as BookingStatusValue[]).map((to) => (
                  <button key={to} type="button" disabled={busy} className={to === 'CANCELLED' || to === 'REJECTED' ? 'btn btn--danger' : 'btn'}
                    onClick={() => run(() => mutate(`/api/v1/admin/bookings/${b.id}/transition`, 'POST', { to, reason: reason || undefined }), `Status changed to ${STATUS_LABELS[to]}.`)}>
                    {ACTION_LABELS[to] ?? to}
                  </button>
                ))}
              </div>
            </section>
          )}

          {can('bookings.manage') && ['ENQUIRY_SUBMITTED', 'AWAITING_REVIEW', 'AWAITING_PAYMENT', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLATION_REQUESTED'].includes(b.status) && (
            <section className="panel">
              <h2>Reschedule</h2>
              <p className="small muted">Availability is re-checked for the same duration. The resource is kept if free, otherwise another eligible one is assigned.</p>
              <form className="toolbar" onSubmit={(e) => { e.preventDefault(); run(() => mutate(`/api/v1/admin/bookings/${b.id}/reschedule`, 'POST', resched), 'Booking rescheduled.'); }}>
                <div className="field"><label htmlFor="rd">New date</label><input id="rd" type="date" className="input" required value={resched.date} onChange={(e) => setResched({ ...resched, date: e.target.value })} /></div>
                <div className="field"><label htmlFor="rt">Start ({b.timezone})</label><input id="rt" type="time" step={900} className="input" required value={resched.startTime} onChange={(e) => setResched({ ...resched, startTime: e.target.value })} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="rr">Reason</label><input id="rr" className="input" required minLength={3} value={resched.reason} onChange={(e) => setResched({ ...resched, reason: e.target.value })} /></div>
                <button className="btn" type="submit" disabled={busy}>Reschedule</button>
              </form>
            </section>
          )}

          <section className="panel">
            <h2>Payments</h2>
            {b.transactions.length === 0 && b.paymentOrders.length === 0 ? <p className="muted">No payment activity.</p> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Date</th><th>Type</th><th>Provider</th><th>Status</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {b.transactions.map((t: any) => {
                    const refunded = t.refunds.filter((r: any) => r.status !== 'FAILED').reduce((s: number, r: any) => s + r.amountMinor, 0);
                    return (
                      <tr key={t.id} className={t.isSimulated ? 'sim' : undefined}>
                        <td>{formatDateTime(t.createdAt, b.timezone)}</td>
                        <td>{t.type.toLowerCase()}</td>
                        <td>{t.provider}{t.isSimulated && <> <span className="badge badge--demo">Simulated</span></>}<div className="small muted mono">{t.providerPaymentId}</div></td>
                        <td>{t.status.toLowerCase()}{t.failureReason && <div className="small">{t.failureReason}</div>}</td>
                        <td className="price">{formatMoney(t.amountMinor)}{refunded > 0 && <div className="small muted">refunded {formatMoney(refunded)}</div>}</td>
                        <td>{can('payments.refund') && t.type === 'CHARGE' && t.status === 'SUCCEEDED' && refunded < t.amountMinor && (
                          <RefundButton max={t.amountMinor - refunded} onRefund={(amountMinor, r) => run(() => mutate(`/api/v1/admin/transactions/${t.id}/refund`, 'POST', { amountMinor, reason: r }), t.isSimulated ? 'Simulated refund recorded.' : 'Refund requested from provider (pending confirmation).')} />
                        )}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
            {b.paymentOrders.some((o: any) => o.status === 'FAILED') && (
              <p className="small muted">Failed attempts: {b.paymentOrders.filter((o: any) => o.status === 'FAILED').map((o: any) => `${formatDateTime(o.createdAt, b.timezone)} (${o.failureReason ?? 'failed'})`).join('; ')}</p>
            )}
          </section>

          <section className="panel">
            <h2>Status history</h2>
            <ol className="timeline">
              {b.history.map((h: any) => (
                <li key={h.id}>
                  <strong>{STATUS_LABELS[h.toStatus as BookingStatusValue]}</strong> <span className="small muted">· {formatDateTime(h.createdAt, b.timezone)} · {h.actorType.toLowerCase()}{h.actor ? ` (${h.actor.name})` : ''}</span>
                  {h.reason && <div className="small">{h.reason}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div>
          <section className="panel">
            <h2>Price</h2>
            <PriceBreakdown lines={b.items} totalMinor={b.totalMinor} depositMinor={b.depositMinor} amountPaidMinor={b.amountPaidMinor} />
            {b.amountRefundedMinor > 0 && <p className="small">Refunded: {formatMoney(b.amountRefundedMinor)}</p>}
            <p className="small">Balance: <strong>{formatMoney(Math.max(b.totalMinor - b.amountPaidMinor, 0))}</strong></p>
          </section>
          <section className="panel">
            <h2>Internal notes</h2>
            {can('bookings.manage') && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); if (note.trim()) run(async () => { const r = await mutate(`/api/v1/admin/bookings/${b.id}/notes`, 'POST', { body: note }); if (r.ok) setNote(''); return r; }, 'Note added.'); }}>
                <label htmlFor="note" className="visually-hidden">New note</label>
                <textarea id="note" className="textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to staff only" />
                <div><button className="btn btn--sm" type="submit" disabled={busy || !note.trim()}>Add note</button></div>
              </form>
            )}
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--space-4)' }}>
              {b.notes.map((n: any) => <li key={n.id} style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-3) 0' }}><div className="small muted">{n.author?.name ?? 'Staff'} · {formatDateTime(n.createdAt, b.timezone)}</div>{n.body}</li>)}
              {!b.notes.length && <li className="muted small">No notes yet.</li>}
            </ul>
          </section>
          <section className="panel">
            <h2>Notifications</h2>
            {b.notifications.length ? (
              <ul className="small" style={{ paddingLeft: '1em' }}>
                {b.notifications.map((n: any) => <li key={n.id}>{n.channel.toLowerCase()} · {n.template} · <strong>{n.status.toLowerCase().replace('_', ' ')}</strong></li>)}
              </ul>
            ) : <p className="muted small">None.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function RefundButton({ max, onRefund }: { max: number; onRefund: (amountMinor: number, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(max / 100));
  const [reason, setReason] = useState('');
  if (!open) return <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>Refund</button>;
  return (
    <form className="stack" style={{ minWidth: 200 }} onSubmit={(e) => { e.preventDefault(); onRefund(Math.round(Number(amount) * 100), reason); setOpen(false); }}>
      <label className="small">Amount (₹, max {max / 100})<input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="small">Reason<input className="input" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="cluster"><button className="btn btn--danger btn--sm" type="submit">Refund</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}
