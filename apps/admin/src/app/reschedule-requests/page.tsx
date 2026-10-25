'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ['PENDING', 'APPROVED', 'DECLINED'] as const;

export default function RescheduleRequestsPage() {
  const can = useCan();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('PENDING');
  const { data, error, reload } = useAdminData<any[]>(`/api/v1/admin/reschedule-requests?status=${status}`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const manage = can('bookings.manage');

  async function decide(id: string, approve: boolean) {
    setBusy(true);
    const r = await mutate(`/api/v1/admin/reschedule-requests/${id}/decide`, 'POST', { approve, note: notes[id] || undefined });
    setBusy(false);
    setMsg(r.ok ? { tone: 'success', text: approve ? 'Approved. The booking has been moved and the customer notified.' : 'Declined. The customer has been notified; the original time stands.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    reload();
  }

  async function reminders() {
    setBusy(true);
    const r = await mutate<{ considered: number; sent: number }>('/api/v1/admin/reminders/run', 'POST');
    setBusy(false);
    setMsg(r.ok ? { tone: 'success', text: `Reminders: ${r.data.sent} sent for ${r.data.considered} confirmed sessions in the next 24 hours (sessions already reminded are skipped).` } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
  }

  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Reschedule requests</h1>
        {manage && <button className="btn btn--ghost btn--sm" disabled={busy} onClick={reminders}>Send session reminders now</button>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Approving re-checks that the new time is still free and moves the booking. Until a decision, the customer keeps their original slot. Reminders respect each customer&rsquo;s notification preferences; without a configured email provider they are stored as previews under Notifications.</p>
      <div className="filters" role="tablist" aria-label="Request status">
        {STATUSES.map((s) => <button key={s} role="tab" aria-selected={status === s} className="chip" onClick={() => setStatus(s)}>{s.toLowerCase()}</button>)}
      </div>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (data.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Booking</th><th>Current time</th><th>Requested time</th><th>Reason</th><th>{status === 'PENDING' ? 'Decision' : 'Note'}</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td><Link className="mono" href={`/bookings/${r.booking.id}`}>{r.booking.reference}</Link><div className="small muted">{r.booking.service.name} · {r.booking.contactName}</div></td>
                <td className="small">{formatDateTime(r.booking.startsAt, r.booking.timezone)}</td>
                <td className="small"><strong>{formatDateTime(r.requestedStart, r.booking.timezone)}</strong><div className="muted">asked {formatDateTime(r.createdAt, r.booking.timezone)}</div></td>
                <td className="small">{r.reason ?? '—'}</td>
                <td>
                  {status === 'PENDING' && manage ? (
                    <div className="stack" style={{ gap: 'var(--space-2)', minWidth: 220 }}>
                      <label className="visually-hidden" htmlFor={`note-${r.id}`}>Note to customer</label>
                      <input id={`note-${r.id}`} className="input" placeholder="Note to customer (optional)" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                      <div className="cluster">
                        <button className="btn btn--sm" disabled={busy} onClick={() => decide(r.id, true)}>Approve</button>
                        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => decide(r.id, false)}>Decline</button>
                      </div>
                    </div>
                  ) : <span className="small">{r.decisionNote ?? '—'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : <div className="empty">No {status.toLowerCase()} requests.</div>)}
    </div>
  );
}
