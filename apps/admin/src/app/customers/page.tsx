'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, error } = useAdminData<{ total: number; items: any[] }>(`/api/v1/admin/customers${search ? `?q=${encodeURIComponent(search)}` : ''}`);
  return (
    <div className="stack">
      <h1>Customers</h1>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
        <div className="field"><label htmlFor="q">Search</label><input id="q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" /></div>
        <button className="btn" type="submit">Search</button>
      </form>
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (data.items.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Account</th><th>Bookings</th><th>Enquiries</th></tr></thead>
          <tbody>{data.items.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/customers/${c.id}`}>{c.fullName}</Link>{c.isDemo && <> <span className="badge badge--demo">Demo</span></>}</td>
              <td>{c.email}</td><td>{c.phone ?? '—'}</td><td>{c.hasAccount ? 'Registered' : 'Guest'}</td><td>{c.bookings}</td><td>{c.enquiries}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty">No customers found.</div>)}
    </div>
  );
}
