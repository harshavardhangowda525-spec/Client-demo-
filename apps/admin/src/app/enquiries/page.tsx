'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatCalendarDate, formatDateTime } from '@studio/ui';
import { useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'DECLINED', 'CONVERTED', 'CLOSED'];

export default function EnquiriesPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { q: search } : {}) });
  const { data, error } = useAdminData<{ total: number; items: any[] }>(`/api/v1/admin/enquiries?${qs}`);
  return (
    <div className="stack">
      <h1>Enquiries &amp; briefs</h1>
      <p className="muted small">Event enquiries and project briefs from the studio site. Enquiries are never bookings: review, quote, and convert accepted proposals into bookings.</p>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <div className="field"><label htmlFor="q">Search</label><input id="q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, name or email" /></div>
        <div className="field"><label htmlFor="s">Status</label><select id="s" className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</select></div>
        <button className="btn" type="submit">Search</button>
      </form>
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (data.items.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Reference</th><th>Website</th><th>Event / project</th><th>Preferred date</th><th>People</th><th>Contact</th><th>Status</th><th>Assigned</th><th>Received</th></tr></thead>
          <tbody>{data.items.map((e) => (
            <tr key={e.id}>
              <td><Link className="mono" href={`/enquiries/${e.id}`}>{e.reference}</Link>{e.isDemo && <> <span className="badge badge--demo">Demo</span></>}</td>
              <td className="small">{e.brand.toLowerCase()}{e.sourceSite === 'STUDIO' ? ' · studio site' : ''}</td>
              <td>{e.eventType}<div className="small muted">{e.category?.name}</div></td>
              <td>{formatCalendarDate(e.preferredDate.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td>{e.expectedAttendance}</td>
              <td>{e.contactName}<div className="small muted">{e.contactEmail}</div></td>
              <td><span className="badge">{e.status.replace('_', ' ').toLowerCase()}</span></td>
              <td className="small">{e.assignedTo?.name ?? '—'}</td>
              <td className="small">{formatDateTime(e.createdAt, 'Asia/Kolkata')}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty">No enquiries match.</div>)}
    </div>
  );
}
