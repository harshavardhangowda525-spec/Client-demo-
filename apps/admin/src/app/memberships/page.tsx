'use client';

import { useState } from 'react';
import { formatMoney } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const EMPTY = { key: '', name: '', tagline: '', price: '', periodDays: '30', discount: '50', perks: '', sortOrder: '0', isFeatured: false, isActive: true, isSample: false };
const STATUS_TONE: Record<string, string> = { ACTIVE: 'badge--success', EXPIRED: '', CANCELLED: 'badge--danger' };

export default function MembershipsPage() {
  const can = useCan();
  const manage = can('catalog.manage');
  const { data: plans, error, reload } = useAdminData<any[]>('/api/v1/admin/membership/plans');
  const { data: members, reload: reloadMembers } = useAdminData<any[]>(can('customers.read') ? '/api/v1/admin/memberships' : null);
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);

  function edit(p: any) {
    setMsg(null);
    setForm({
      id: p.id, key: p.key, name: p.name, tagline: p.tagline ?? '', price: String(p.priceMinor / 100), periodDays: String(p.periodDays),
      discount: String(p.bookingDiscountBps / 100), perks: p.perks.join('\n'), sortOrder: String(p.sortOrder), isFeatured: p.isFeatured, isActive: p.isActive, isSample: p.isSample,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      key: form.key, name: form.name, tagline: form.tagline || null, priceMinor: Math.round(Number(form.price) * 100), periodDays: Number(form.periodDays),
      bookingDiscountBps: Math.round(Number(form.discount) * 100), perks: form.perks.split('\n').map((s: string) => s.trim()).filter(Boolean),
      sortOrder: Number(form.sortOrder), isFeatured: form.isFeatured, isActive: form.isActive, isSample: form.isSample,
    };
    const r = await mutate(form.id ? `/api/v1/admin/membership/plans/${form.id}` : '/api/v1/admin/membership/plans', form.id ? 'PUT' : 'POST', body);
    setMsg(r.ok ? { tone: 'success', text: 'Plan saved. The website shows the new details straight away.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    if (r.ok) { setForm(null); reload(); }
  }

  async function cancel(m: any) {
    if (!window.confirm(`End ${m.customerName}'s ${m.planName} membership now? No refund is issued.`)) return;
    const r = await mutate(`/api/v1/admin/memberships/${m.id}/cancel`, 'POST', {});
    setMsg(r.ok ? { tone: 'success', text: 'Membership ended.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    if (r.ok) { reloadMembers(); reload(); }
  }

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const input = (k: string, label: string, props: any = {}) => <div className="field"><label htmlFor={`mp-${k}`}>{label}</label><input id={`mp-${k}`} className="input" value={form[k] ?? ''} onChange={set(k)} {...props} /></div>;

  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Memberships</h1>
        {manage && !form && <button className="btn btn--sm" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>New plan</button>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Customers buy a plan on the Infinity Studios site. It activates only after the payment is verified. Members get the plan&rsquo;s discount on every booking (before fees and tax), and the site switches to the premium member look.</p>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}

      {form && (
        <form className="panel stack" onSubmit={save}>
          <h2 style={{ margin: 0 }}>{form.id ? `Edit ${form.name}` : 'New plan'}</h2>
          <div className="form-row form-row--3">
            {input('name', 'Plan name', { required: true, placeholder: 'e.g. Pro' })}
            {input('key', 'Key (used in links)', { required: true, placeholder: 'e.g. pro' })}
            {input('tagline', 'Tagline')}
          </div>
          <div className="form-row form-row--3">
            {input('price', 'Price (₹)', { inputMode: 'decimal', required: true })}
            {input('periodDays', 'Length (days)', { inputMode: 'numeric', required: true })}
            {input('discount', 'Booking discount for members (%)', { inputMode: 'decimal', required: true })}
          </div>
          <div className="field"><label htmlFor="mp-perks">Perks (one per line)</label><textarea id="mp-perks" className="textarea" value={form.perks} onChange={set('perks')} /></div>
          <div className="form-row form-row--3">{input('sortOrder', 'Order on the page', { inputMode: 'numeric' })}</div>
          <div className="cluster">
            <label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /><span>On sale</span></label>
            <label className="checkbox"><input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} /><span>Highlight as most popular</span></label>
            <label className="checkbox"><input type="checkbox" checked={form.isSample} onChange={set('isSample')} /><span>Sample price (labelled on the site)</span></label>
          </div>
          <div className="cluster"><button className="btn" type="submit">Save plan</button><button type="button" className="btn btn--ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {plans && (plans.length ? (
        <div className="table-wrap"><table className="table">
          <caption className="visually-hidden">Membership plans</caption>
          <thead><tr><th>Plan</th><th>Price</th><th>Booking discount</th><th>Active members</th><th>Status</th><th /></tr></thead>
          <tbody>{plans.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name}</strong>{p.isFeatured && <span className="badge" style={{ marginLeft: 6 }}>Most popular</span>}{p.isSample && <span className="badge badge--demo" style={{ marginLeft: 6 }}>Sample</span>}<div className="small muted">{p.tagline}</div></td>
              <td>{formatMoney(p.priceMinor)} / {p.periodDays} days</td>
              <td>{p.bookingDiscountBps / 100}%</td>
              <td>{p.activeMembers}</td>
              <td>{p.isActive ? <span className="badge badge--success">On sale</span> : <span className="badge">Off</span>}</td>
              <td>{manage && <button className="btn btn--ghost btn--sm" onClick={() => edit(p)}>Edit</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty">No plans yet.</div>)}

      {members && (
        <section className="stack">
          <h2 style={{ margin: 0 }}>Members</h2>
          {members.length ? (
            <div className="table-wrap"><table className="table">
              <caption className="visually-hidden">Memberships</caption>
              <thead><tr><th>Customer</th><th>Plan</th><th>Paid</th><th>Period</th><th>Status</th><th /></tr></thead>
              <tbody>{members.map((m) => (
                <tr key={m.id}>
                  <td>{m.customerName}<div className="small muted">{m.customerEmail}</div></td>
                  <td>{m.planName}</td>
                  <td>{formatMoney(m.amountMinor, m.currency)}{m.isSimulated && <div className="small muted">{m.provider === 'DEMO' ? 'Demo payment' : 'Razorpay test mode'}</div>}</td>
                  <td className="small">{m.startsAt ? new Date(m.startsAt).toLocaleDateString('en-IN') : ''} – {m.endsAt ? new Date(m.endsAt).toLocaleDateString('en-IN') : ''}</td>
                  <td><span className={`badge ${STATUS_TONE[m.status] ?? ''}`}>{m.status.charAt(0) + m.status.slice(1).toLowerCase()}</span></td>
                  <td>{m.status === 'ACTIVE' && can('bookings.manage') && <button className="btn btn--ghost btn--sm" onClick={() => cancel(m)}>End now</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <div className="empty">No one has bought a membership yet.</div>}
        </section>
      )}
    </div>
  );
}
