'use client';

import Link from 'next/link';
import { formatDateTime, formatMoney, StatusBadge } from '@studio/ui';
import { useAdminData } from '../lib/client';

interface Dashboard {
  generatedAt: string;
  bookingsByStatus: Record<string, number>;
  activeBookingsByBrand: Record<string, number>;
  needsReview: number;
  enquiriesByStatus: Record<string, number>;
  followUpsDue: number;
  newContactMessages: number;
  last30Days: Record<string, { amountMinor: number; count: number } | number>;
  outstandingBalanceMinor: { real: number; demo: number };
  upcoming: { id: string; reference: string; brand: string; startsAt: string; timezone: string; service: string; location: string; contactName: string; status: string }[];
  totals: { bookings: number; enquiries: number; pendingReschedules: number };
  popularServices: { serviceId: string; name: string; bookings: number }[];
  occupancyToday: { resourceId: string; resource: string; location: string; openMinutes: number; bookedMinutes: number }[];
  recent: { id: string; reference: string; brand: string; status: string; createdAt: string; service: string; contactName: string; totalMinor: number; isDemo: boolean }[];
}

const money = (v: unknown) => formatMoney((v as { amountMinor: number }).amountMinor);
const count = (v: unknown) => (v as { count: number }).count;

export default function DashboardPage() {
  const { data, error, loading } = useAdminData<Dashboard>('/api/v1/admin/dashboard');
  if (loading && !data) return <p className="muted">Loading…</p>;
  if (error) return <div className="alert alert--danger">{error.message}</div>;
  if (!data) return null;
  const totalBookings = Object.values(data.bookingsByStatus).reduce((a, b) => a + b, 0);
  const openEnquiries = (data.enquiriesByStatus.SUBMITTED ?? 0) + (data.enquiriesByStatus.UNDER_REVIEW ?? 0);
  const l = data.last30Days;
  return (
    <div className="stack-lg">
      <div>
        <h1>Dashboard</h1>
        <p className="muted small">Calculated from live database records at {new Date(data.generatedAt).toLocaleTimeString('en-IN')}. Simulated and Razorpay test-mode payments are shown separately and never counted as revenue.</p>
      </div>
      <div className="stat-grid">
        <Link href="/bookings?status=ENQUIRY_SUBMITTED" className="stat" style={{ textDecoration: 'none' }}><div className="value">{data.needsReview}</div><div className="label">Bookings needing review</div></Link>
        <Link href="/enquiries" className="stat" style={{ textDecoration: 'none' }}><div className="value">{openEnquiries}</div><div className="label">Open event enquiries</div></Link>
        <Link href="/reschedule-requests" className="stat" style={{ textDecoration: 'none' }}><div className="value">{data.totals.pendingReschedules}</div><div className="label">Reschedule requests to decide</div></Link>
        <div className="stat"><div className="value">{data.followUpsDue}</div><div className="label">Follow-ups due within 7 days</div></div>
        <div className="stat"><div className="value">{data.newContactMessages}</div><div className="label">New contact messages</div></div>
        <div className="stat"><div className="value">{money(l.realCharges)}</div><div className="label">Real payments, 30 days ({count(l.realCharges)})</div></div>
        <div className="stat sim"><div className="value">{money(l.simulatedCharges)}</div><div className="label">Simulated / test-mode payments, 30 days ({count(l.simulatedCharges)}). Not revenue.</div></div>
        <div className="stat"><div className="value">{formatMoney(data.outstandingBalanceMinor.real)}</div><div className="label">Outstanding balances (real bookings)</div></div>
        <div className="stat"><div className="value">{l.failedPaymentOrders as number}</div><div className="label">Failed payment attempts, 30 days</div></div>
      </div>
      <div className="cols">
        <section className="panel">
          <h2>Upcoming confirmed sessions (7 days)</h2>
          {data.upcoming.length ? (
            <table className="table"><tbody>
              {data.upcoming.map((b) => (
                <tr key={b.id}><td><Link href={`/bookings/${b.id}`} className="mono">{b.reference}</Link></td><td>{b.service}<div className="small muted">{b.location}</div></td><td>{formatDateTime(b.startsAt, b.timezone)}</td><td>{b.contactName}</td></tr>
              ))}
            </tbody></table>
          ) : <div className="empty">No confirmed sessions in the next 7 days.</div>}
        </section>
        <section className="panel">
          <h2>Bookings by status ({totalBookings})</h2>
          {totalBookings ? (
            <table className="table"><tbody>
              {Object.entries(data.bookingsByStatus).map(([s, n]) => (
                <tr key={s}><td><Link href={`/bookings?status=${s}`}>{s.replace(/_/g, ' ').toLowerCase()}</Link></td><td className="price" style={{ textAlign: 'right' }}>{n}</td></tr>
              ))}
            </tbody></table>
          ) : <div className="empty">No bookings yet.</div>}
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>Active by website: {Object.entries(data.activeBookingsByBrand).map(([b, n]) => `${b.toLowerCase()} ${n}`).join(' · ') || 'none'}</p>
        </section>
      </div>
      <div className="cols">
        <section className="panel">
          <h2>Popular services (90 days)</h2>
          {data.popularServices.length ? (
            <table className="table"><tbody>
              {data.popularServices.map((p) => <tr key={p.serviceId}><td>{p.name}</td><td className="price" style={{ textAlign: 'right' }}>{p.bookings} {p.bookings === 1 ? 'booking' : 'bookings'}</td></tr>)}
            </tbody></table>
          ) : <div className="empty">No bookings in the last 90 days.</div>}
        </section>
        <section className="panel">
          <h2>Room occupancy today</h2>
          {data.occupancyToday.length ? (
            <table className="table">
              <thead><tr><th>Room</th><th>Booked / open</th><th style={{ textAlign: 'right' }}>Occupancy</th></tr></thead>
              <tbody>
                {data.occupancyToday.map((o) => {
                  const pct = o.openMinutes ? Math.min(100, Math.round((o.bookedMinutes / o.openMinutes) * 100)) : null;
                  return (
                    <tr key={o.resourceId}>
                      <td>{o.resource}<div className="small muted">{o.location}</div></td>
                      <td className="small">{Math.round(o.bookedMinutes / 6) / 10} h / {Math.round(o.openMinutes / 6) / 10} h</td>
                      <td style={{ textAlign: 'right' }}>{pct == null ? <span className="small muted">Closed today</span> : <><meter min={0} max={100} value={pct} aria-label={`${o.resource} occupancy`} style={{ width: 70, verticalAlign: 'middle' }} /> {pct}%</>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <div className="empty">No exclusive rooms configured.</div>}
        </section>
      </div>
      <section className="panel">
        <h2>Latest bookings</h2>
        {data.recent.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Reference</th><th>Website</th><th>Service</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {data.recent.map((b) => (
                <tr key={b.id}>
                  <td><Link className="mono" href={`/bookings/${b.id}`}>{b.reference}</Link>{b.isDemo && <> <span className="badge badge--demo">Demo</span></>}</td>
                  <td>{b.brand.toLowerCase()}</td><td>{b.service}</td><td>{b.contactName}</td>
                  <td><StatusBadge status={b.status} label={b.status.replace(/_/g, ' ').toLowerCase()} /></td>
                  <td className="price">{formatMoney(b.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <div className="empty">No bookings yet. They will appear here as soon as customers book on any of the three websites.</div>}
      </section>
    </div>
  );
}
