'use client';

import Link from 'next/link';
import { use } from 'react';
import { formatDateTime, formatMoney, StatusBadge } from '@studio/ui';
import { useAdminData } from '../../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: c, error } = useAdminData<any>(`/api/v1/admin/customers/${id}`);
  if (error) return <div className="alert alert--danger">{error.message}</div>;
  if (!c) return <p className="muted">Loading…</p>;
  return (
    <div className="stack-lg">
      <div><p className="small"><Link href="/customers">← Customers</Link></p><h1>{c.fullName}</h1></div>
      <section className="panel">
        <dl className="dl">
          <dt>Email</dt><dd>{c.email}</dd>
          <dt>Phone</dt><dd>{c.phone ?? '—'}</dd>
          <dt>Company</dt><dd>{c.company ?? '—'}</dd>
          <dt>Account</dt><dd>{c.user ? `Registered ${formatDateTime(c.user.createdAt, 'Asia/Kolkata')}${c.user.emailVerified ? ' · email verified' : ''}` : 'Guest (no login)'}</dd>
          <dt>Marketing</dt><dd>{c.marketingOptIn ? 'Opted in' : 'Not opted in'}</dd>
        </dl>
        <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>Viewing this record is recorded in the audit log.</p>
      </section>
      <section className="panel">
        <h2>Bookings</h2>
        {c.bookings.length ? (
          <table className="table"><tbody>{c.bookings.map((b: any) => (
            <tr key={b.id}><td><Link className="mono" href={`/bookings/${b.id}`}>{b.reference}</Link></td><td>{b.service.name}</td><td>{formatDateTime(b.startsAt, b.timezone)}</td><td><StatusBadge status={b.status} label={b.status.replace(/_/g, ' ').toLowerCase()} /></td><td className="price">{formatMoney(b.totalMinor)}</td></tr>
          ))}</tbody></table>
        ) : <p className="muted">No bookings.</p>}
      </section>
      <section className="panel">
        <h2>Enquiries</h2>
        {c.enquiries.length ? (
          <table className="table"><tbody>{c.enquiries.map((e: any) => (
            <tr key={e.id}><td><Link className="mono" href={`/enquiries/${e.id}`}>{e.reference}</Link></td><td>{e.eventType}</td><td>{e.status.toLowerCase()}</td></tr>
          ))}</tbody></table>
        ) : <p className="muted">No enquiries.</p>}
      </section>
    </div>
  );
}
