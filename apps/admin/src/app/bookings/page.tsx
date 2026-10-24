'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { BOOKING_STATUSES } from '@studio/core/status';
import { formatDateTime, formatMoney, StatusBadge } from '@studio/ui';
import { useAdminData } from '../../lib/client';

interface Row { id: string; reference: string; brand: string; status: string; paymentStatus: string; startsAt: string; timezone: string; service: string; location: string; resource: string | null; contactName: string; contactEmail: string; totalMinor: number; amountPaidMinor: number; isDemo: boolean }

function BookingsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const qs = new URLSearchParams(sp.toString());
  const { data, error, loading } = useAdminData<{ total: number; page: number; pageSize: number; items: Row[] }>(`/api/v1/admin/bookings?${qs}`);
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v); else n.delete(k);
    n.delete('page');
    router.push(`/bookings?${n}`);
  };
  const page = Number(sp.get('page') ?? 1);
  return (
    <div className="stack">
      <h1>Bookings</h1>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setParam('q', q); }}>
        <div className="field"><label htmlFor="q">Search</label><input id="q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, name or email" /></div>
        <div className="field"><label htmlFor="brand">Website</label>
          <select id="brand" className="select" value={sp.get('brand') ?? ''} onChange={(e) => setParam('brand', e.target.value)}>
            <option value="">All</option><option value="PHOTO">Photography</option><option value="PODCAST">Podcast</option><option value="EVENTS">Events</option>
          </select></div>
        <div className="field"><label htmlFor="status">Status</label>
          <select id="status" className="select" value={sp.get('status') ?? ''} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">All</option>{BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
          </select></div>
        <div className="field"><label htmlFor="from">From</label><input id="from" type="date" className="input" value={sp.get('from') ?? ''} onChange={(e) => setParam('from', e.target.value)} /></div>
        <div className="field"><label htmlFor="to">To</label><input id="to" type="date" className="input" value={sp.get('to') ?? ''} onChange={(e) => setParam('to', e.target.value)} /></div>
        <button className="btn" type="submit">Search</button>
      </form>
      {error && <div className="alert alert--danger">{error.message}</div>}
      {loading && !data ? <p className="muted">Loading…</p> : data && (
        data.items.length ? (
          <>
            <p className="small muted">{data.total} bookings</p>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Reference</th><th>When</th><th>Service</th><th>Resource</th><th>Customer</th><th>Status</th><th>Paid / total</th></tr></thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td><Link className="mono" href={`/bookings/${b.id}`}>{b.reference}</Link>{b.isDemo && <> <span className="badge badge--demo">Demo</span></>}</td>
                    <td>{formatDateTime(b.startsAt, b.timezone)}</td>
                    <td>{b.service}<div className="small muted">{b.location}</div></td>
                    <td className="small">{b.resource ?? '—'}</td>
                    <td>{b.contactName}<div className="small muted">{b.contactEmail}</div></td>
                    <td><StatusBadge status={b.status} label={b.status.replace(/_/g, ' ').toLowerCase()} /><div className="small muted">{b.paymentStatus.toLowerCase()}</div></td>
                    <td className="price">{formatMoney(b.amountPaidMinor)} / {formatMoney(b.totalMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="cluster">
              <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => { const n = new URLSearchParams(sp.toString()); n.set('page', String(page - 1)); router.push(`/bookings?${n}`); }}>Previous</button>
              <span className="small muted">Page {page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
              <button className="btn btn--ghost btn--sm" disabled={page * data.pageSize >= data.total} onClick={() => { const n = new URLSearchParams(sp.toString()); n.set('page', String(page + 1)); router.push(`/bookings?${n}`); }}>Next</button>
            </div>
          </>
        ) : <div className="empty">No bookings match these filters.</div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return <Suspense fallback={<p className="muted">Loading…</p>}><BookingsInner /></Suspense>;
}
