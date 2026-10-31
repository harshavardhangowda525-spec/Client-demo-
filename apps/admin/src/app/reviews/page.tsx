'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime } from '@studio/ui';
import { errorText, mutate, useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ReviewsPage() {
  const [status, setStatus] = useState<'' | 'PUBLISHED' | 'HIDDEN'>('');
  const { data, error, reload } = useAdminData<any[]>(`/api/v1/admin/reviews${status ? `?status=${status}` : ''}`);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);

  async function moderate(r: any, publish: boolean) {
    const reason = publish ? undefined : prompt('Why are you hiding this review? (kept in the audit log)') ?? '';
    if (!publish && !reason?.trim()) return;
    const res = await mutate(`/api/v1/admin/reviews/${r.id}/moderate`, 'POST', { publish, reason });
    setMsg(res.ok ? { tone: 'success', text: publish ? 'Review shown on the website again.' : 'Review hidden.' } : { tone: 'danger', text: errorText(res.error) ?? 'Failed' });
    reload();
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Ratings &amp; reviews</h1>
      <p className="small muted" style={{ margin: 0 }}>Reviews come only from customers whose session has taken place, one per booking. Staff can hide a review (for example abuse or personal details) with a reason, but cannot edit what a customer wrote.</p>
      <div className="filters" role="tablist" aria-label="Review status">
        {([['', 'All'], ['PUBLISHED', 'Published'], ['HIDDEN', 'Hidden']] as const).map(([v, l]) => <button key={v} role="tab" aria-selected={status === v} className="chip" onClick={() => setStatus(v)}>{l}</button>)}
      </div>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (data.length ? data.map((r) => (
        <article key={r.id} className="panel">
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span><strong style={{ color: 'var(--danger, #b42318)' }} aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</strong> · {r.service.name} · <Link className="mono" href={`/bookings/${r.booking.id}`}>{r.booking.reference}</Link></span>
            {r.status === 'PUBLISHED' ? <button className="btn btn--ghost btn--sm" onClick={() => moderate(r, false)}>Hide</button> : <button className="btn btn--ghost btn--sm" onClick={() => moderate(r, true)}>Show again</button>}
          </div>
          {r.comment ? <p style={{ whiteSpace: 'pre-wrap' }}>{r.comment}</p> : <p className="muted small">No comment, rating only.</p>}
          <p className="small muted" style={{ margin: 0 }}>{r.customer.fullName} ({r.customer.email}) · {formatDateTime(r.createdAt, 'Asia/Kolkata')}{r.status === 'HIDDEN' && <> · <span className="badge">Hidden</span> {r.hiddenReason}</>}</p>
        </article>
      )) : <div className="empty">No reviews yet. They appear once customers rate completed sessions.</div>)}
    </div>
  );
}
