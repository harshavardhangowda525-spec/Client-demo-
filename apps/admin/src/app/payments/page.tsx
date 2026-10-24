'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime, formatMoney } from '@studio/ui';
import { useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function PaymentsPage() {
  const [simulated, setSimulated] = useState('');
  const { data, error } = useAdminData<any>(`/api/v1/admin/payments${simulated ? `?simulated=${simulated}` : ''}`);
  return (
    <div className="stack">
      <h1>Payments</h1>
      <div className="alert alert--warning"><p>Rows marked <strong>Simulated</strong> come from demo mode. No money moved, and they are never counted as real revenue.</p></div>
      <div className="toolbar">
        <div className="field"><label htmlFor="sim">Show</label>
          <select id="sim" className="select" value={simulated} onChange={(e) => setSimulated(e.target.value)}>
            <option value="">Real and simulated</option><option value="false">Real only</option><option value="true">Simulated only</option>
          </select></div>
      </div>
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (
        <>
          <section className="panel">
            <h2>Transactions ({data.total})</h2>
            {data.transactions.length ? (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Date</th><th>Booking</th><th>Type</th><th>Provider / reference</th><th>Status</th><th>Amount</th></tr></thead>
                <tbody>{data.transactions.map((t: any) => (
                  <tr key={t.id} className={t.isSimulated ? 'sim' : undefined}>
                    <td>{formatDateTime(t.createdAt, 'Asia/Kolkata')}</td>
                    <td><Link className="mono" href={`/bookings/${t.booking.id}`}>{t.booking.reference}</Link><div className="small muted">{t.booking.contactName}</div></td>
                    <td>{t.type.toLowerCase()}</td>
                    <td>{t.provider}{t.isSimulated && <> <span className="badge badge--demo">Simulated</span></>}<div className="small mono muted">{t.providerPaymentId}</div></td>
                    <td>{t.status.toLowerCase()}</td>
                    <td className="price">{formatMoney(t.amountMinor, t.currency)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <div className="empty">No transactions recorded.</div>}
          </section>
          <section className="panel">
            <h2>Failed payment attempts</h2>
            {data.failedOrders.length ? (
              <table className="table"><tbody>{data.failedOrders.map((o: any) => (
                <tr key={o.id}><td>{formatDateTime(o.createdAt, 'Asia/Kolkata')}</td><td><Link className="mono" href={`/bookings/${o.booking.id}`}>{o.booking.reference}</Link></td><td>{o.provider}{o.isSimulated ? ' (simulated)' : ''}</td><td>{o.failureReason}</td><td className="price">{formatMoney(o.amountMinor)}</td></tr>
              ))}</tbody></table>
            ) : <p className="muted">None.</p>}
          </section>
          <section className="panel">
            <h2>Refunds</h2>
            {data.refunds.length ? (
              <table className="table"><tbody>{data.refunds.map((r: any) => (
                <tr key={r.id} className={r.isSimulated ? 'sim' : undefined}><td>{formatDateTime(r.createdAt, 'Asia/Kolkata')}</td><td><Link className="mono" href={`/bookings/${r.booking.id}`}>{r.booking.reference}</Link></td><td>{r.status.toLowerCase()}{r.isSimulated ? ' · simulated' : ''}</td><td>{r.reason}</td><td className="price">{formatMoney(r.amountMinor)}</td></tr>
              ))}</tbody></table>
            ) : <p className="muted">None.</p>}
          </section>
        </>
      )}
    </div>
  );
}
