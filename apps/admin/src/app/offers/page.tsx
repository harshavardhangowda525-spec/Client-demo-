'use client';

import { useState } from 'react';
import { formatMoney } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const rupees = (minor: number | null | undefined) => (minor == null ? '' : String(minor / 100));
const toMinor = (v: string) => (v.trim() === '' ? null : Math.round(Number(v) * 100));
const localInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const EMPTY = { code: '', title: '', description: '', terms: '', discountType: 'PERCENT', value: '10', maxDiscount: '', minOrder: '0', validFrom: '', validUntil: '', usageLimit: '', perCustomerLimit: '1', isActive: true, showOnSite: true, serviceIds: [] as string[] };

export default function OffersPage() {
  const can = useCan();
  const manage = can('catalog.manage');
  const { data, error, reload } = useAdminData<any[]>('/api/v1/admin/offers');
  const { data: catalog } = useAdminData<any>('/api/v1/admin/catalog');
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const services = (catalog?.services ?? []).filter((s: any) => s.isActive && s.bookingMode !== 'ENQUIRY');

  function edit(o: any) {
    setMsg(null);
    setForm({
      id: o.id, code: o.code, title: o.title, description: o.description ?? '', terms: o.terms ?? '', discountType: o.discountType,
      value: o.discountType === 'PERCENT' ? String(o.value / 100) : rupees(o.value), maxDiscount: rupees(o.maxDiscountMinor), minOrder: rupees(o.minOrderMinor),
      validFrom: localInput(o.validFrom), validUntil: localInput(o.validUntil), usageLimit: o.usageLimit ?? '', perCustomerLimit: o.perCustomerLimit ?? '',
      isActive: o.isActive, showOnSite: o.showOnSite, serviceIds: o.serviceIds,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      code: form.code, title: form.title, description: form.description || null, terms: form.terms || null, discountType: form.discountType,
      value: form.discountType === 'PERCENT' ? Math.round(Number(form.value) * 100) : toMinor(form.value),
      maxDiscountMinor: form.discountType === 'PERCENT' ? toMinor(form.maxDiscount) : null, minOrderMinor: toMinor(form.minOrder) ?? 0,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null, validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit), perCustomerLimit: form.perCustomerLimit === '' ? null : Number(form.perCustomerLimit),
      isActive: form.isActive, showOnSite: form.showOnSite, serviceIds: form.serviceIds,
    };
    const r = await mutate(form.id ? `/api/v1/admin/offers/${form.id}` : '/api/v1/admin/offers', form.id ? 'PUT' : 'POST', body);
    setMsg(r.ok ? { tone: 'success', text: 'Offer saved.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    if (r.ok) { setForm(null); reload(); }
  }

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const input = (k: string, label: string, props: any = {}) => <div className="field"><label htmlFor={`of-${k}`}>{label}</label><input id={`of-${k}`} className="input" value={form[k] ?? ''} onChange={set(k)} {...props} /></div>;

  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Offers &amp; coupons</h1>
        {manage && !form && <button className="btn btn--sm" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>New offer</button>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Customers enter the code at checkout. Discounts apply to the service and add-ons before fees and tax, are calculated on the server, and limits are enforced even when people book at the same time. Cancelled bookings give their use back.</p>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}

      {form && (
        <form className="panel stack" onSubmit={save}>
          <h2 style={{ margin: 0 }}>{form.id ? `Edit ${form.code}` : 'New offer'}</h2>
          <div className="form-row form-row--3">
            {input('code', 'Coupon code', { required: true, placeholder: 'e.g. FIRST10', style: { textTransform: 'uppercase' } })}
            {input('title', 'Title shown to customers', { required: true })}
            <div className="field"><label htmlFor="of-type">Discount type</label><select id="of-type" className="select" value={form.discountType} onChange={set('discountType')}><option value="PERCENT">Percentage</option><option value="FLAT">Fixed amount (₹)</option></select></div>
          </div>
          <div className="form-row form-row--3">
            {input('value', form.discountType === 'PERCENT' ? 'Discount (%)' : 'Discount (₹)', { inputMode: 'decimal', required: true })}
            {form.discountType === 'PERCENT' && input('maxDiscount', 'Maximum discount (₹, optional)', { inputMode: 'decimal' })}
            {input('minOrder', 'Minimum order before tax (₹)', { inputMode: 'decimal' })}
          </div>
          <div className="form-row form-row--3">
            {input('validFrom', 'Starts (optional)', { type: 'datetime-local' })}
            {input('validUntil', 'Ends (optional)', { type: 'datetime-local' })}
            {input('usageLimit', 'Total uses (blank = unlimited)', { inputMode: 'numeric' })}
          </div>
          <div className="form-row form-row--3">
            {input('perCustomerLimit', 'Uses per customer (blank = unlimited)', { inputMode: 'numeric' })}
          </div>
          <div className="field"><label htmlFor="of-desc">Description</label><textarea id="of-desc" className="textarea" value={form.description} onChange={set('description')} /></div>
          <div className="field"><label htmlFor="of-terms">Terms</label><textarea id="of-terms" className="textarea" value={form.terms} onChange={set('terms')} /></div>
          <fieldset><legend className="label">Valid for (none ticked = all services)</legend>
            <div className="cluster">{services.map((s: any) => (
              <label key={s.id} className="checkbox small"><input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={() => setForm({ ...form, serviceIds: form.serviceIds.includes(s.id) ? form.serviceIds.filter((x: string) => x !== s.id) : [...form.serviceIds, s.id] })} /><span>{s.name}</span></label>
            ))}</div>
          </fieldset>
          <div className="cluster">
            <label className="checkbox"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /><span>Active</span></label>
            <label className="checkbox"><input type="checkbox" checked={form.showOnSite} onChange={set('showOnSite')} /><span>Show on the website&rsquo;s Offers page</span></label>
          </div>
          <div className="cluster"><button className="btn" type="submit">Save offer</button><button type="button" className="btn btn--ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {data && (data.length ? (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Code</th><th>Offer</th><th>Validity</th><th>Used</th><th>Discount given</th><th>Status</th><th /></tr></thead>
          <tbody>{data.map((o) => (
            <tr key={o.id}>
              <td className="mono"><strong>{o.code}</strong>{o.isDemo && <div><span className="badge badge--demo">Sample</span></div>}</td>
              <td>{o.title}<div className="small muted">{o.summary}{o.serviceIds.length ? ` · ${o.serviceIds.length} service(s)` : ' · all services'}</div></td>
              <td className="small">{o.validFrom ? new Date(o.validFrom).toLocaleDateString('en-IN') : 'Now'} – {o.validUntil ? new Date(o.validUntil).toLocaleDateString('en-IN') : 'no end'}</td>
              <td>{o.redemptions}{o.usageLimit ? ` / ${o.usageLimit}` : ''}</td>
              <td>{formatMoney(o.discountGivenMinor)}</td>
              <td>{o.isActive ? <span className="badge badge--success">Active</span> : <span className="badge">Off</span>}{!o.showOnSite && <div className="small muted">code only</div>}</td>
              <td>{manage && <button className="btn btn--ghost btn--sm" onClick={() => edit(o)}>Edit</button>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty">No offers yet.</div>)}
    </div>
  );
}
