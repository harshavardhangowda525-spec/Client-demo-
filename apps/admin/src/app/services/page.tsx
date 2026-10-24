'use client';

import { useState, type FormEvent } from 'react';
import { formatMoney } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const BRANDS = ['PHOTO', 'PODCAST', 'EVENTS'];
const toMinor = (v: string) => Math.round(Number(v || 0) * 100);

export default function ServicesPage() {
  const can = useCan();
  const [brand, setBrand] = useState('PHOTO');
  const { data, error, reload } = useAdminData<any>(`/api/v1/admin/catalog?brand=${brand}`);
  const { data: locations } = useAdminData<any[]>('/api/v1/admin/locations');
  const { data: media } = useAdminData<any[]>('/api/v1/admin/media');
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const manage = can('catalog.manage');

  async function save(path: string, method: 'POST' | 'PUT', body: object, ok: string) {
    const r = await mutate(path, method, body);
    setMsg(r.ok ? { tone: 'success', text: ok } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    if (r.ok) { setEditing(null); reload(); }
    return r.ok;
  }

  return (
    <div className="stack">
      <h1>Services &amp; packages</h1>
      <div className="filters" role="tablist" aria-label="Website">
        {BRANDS.map((b) => <button key={b} role="tab" aria-selected={brand === b} className="chip" onClick={() => { setBrand(b); setEditing(null); }}>{b.toLowerCase()}</button>)}
      </div>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (
        <>
          <section className="panel">
            <div className="cluster" style={{ justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>Services</h2>{manage && <button className="btn btn--sm" onClick={() => setEditing('new')}>New service</button>}</div>
            {editing === 'new' && <ServiceForm brand={brand} categories={data.categories} addOns={data.addOns} locations={locations ?? []} media={media ?? []} onSubmit={(b: object) => save('/api/v1/admin/services', 'POST', b, 'Service created.')} onCancel={() => setEditing(null)} />}
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Service</th><th>Mode</th><th>Pricing</th><th>Packages</th><th>Bookings</th><th>Status</th><th /></tr></thead>
              <tbody>{data.services.map((s: any) => (
                <ServiceRow key={s.id} s={s} manage={manage} editing={editing === s.id} onEdit={() => setEditing(editing === s.id ? null : s.id)}>
                  <ServiceForm brand={brand} initial={s} categories={data.categories} addOns={data.addOns} locations={locations ?? []} media={media ?? []} onSubmit={(b: object) => save(`/api/v1/admin/services/${s.id}`, 'PUT', b, 'Service updated.')} onCancel={() => setEditing(null)} />
                  <Packages service={s} manage={manage} save={save} />
                </ServiceRow>
              ))}</tbody>
            </table></div>
          </section>
          <section className="panel">
            <h2>Add-ons</h2>
            <SimpleList rows={data.addOns} manage={manage} fields={[['name', 'Name'], ['slug', 'Slug'], ['description', 'Description'], ['pricing', 'Pricing (FIXED / PER_HOUR)'], ['price', 'Price (₹)']]}
              toForm={(a: any) => ({ name: a.name, slug: a.slug, description: a.description ?? '', pricing: a.pricing, price: String(a.priceMinor / 100), isActive: a.isActive })}
              render={(a: any) => <>{a.name} · {formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? '/hr' : ''}{!a.isActive && ' · inactive'}{a.isDemo && <> <span className="badge badge--demo">Sample</span></>}</>}
              onSave={(id, f) => save(id ? `/api/v1/admin/addons/${id}` : '/api/v1/admin/addons', id ? 'PUT' : 'POST', { brand, name: f.name, slug: f.slug, description: f.description || null, pricing: f.pricing, priceMinor: toMinor(f.price), isActive: f.isActive ?? true }, 'Add-on saved.')} />
          </section>
          <section className="panel">
            <h2>Categories</h2>
            <SimpleList rows={data.categories} manage={manage} fields={[['name', 'Name'], ['slug', 'Slug'], ['description', 'Description'], ['sortOrder', 'Sort order']]}
              toForm={(c: any) => ({ name: c.name, slug: c.slug, description: c.description ?? '', sortOrder: String(c.sortOrder), isActive: c.isActive })}
              render={(c: any) => <>{c.name} <span className="muted small">/{c.slug}</span>{!c.isActive && ' · inactive'}</>}
              onSave={(id, f) => save(id ? `/api/v1/admin/categories/${id}` : '/api/v1/admin/categories', id ? 'PUT' : 'POST', { brand, name: f.name, slug: f.slug, description: f.description || null, sortOrder: Number(f.sortOrder || 0), isActive: f.isActive ?? true }, 'Category saved.')} />
          </section>
        </>
      )}
    </div>
  );
}

function ServiceRow({ s, manage, editing, onEdit, children }: { s: any; manage: boolean; editing: boolean; onEdit: () => void; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td><strong>{s.name}</strong>{s.isDemo && <> <span className="badge badge--demo">Sample</span></>}<div className="small muted">{s.category?.name}</div></td>
        <td className="small">{s.bookingMode.toLowerCase()}</td>
        <td className="small">{s.pricingModel === 'HOURLY' ? `${formatMoney(s.hourlyRateMinor)}/hr` : s.pricingModel === 'QUOTE' ? 'quotation' : formatMoney(s.basePriceMinor)}</td>
        <td>{s.packages.length}</td>
        <td>{s._count.bookings}</td>
        <td>{s.isActive ? <span className="badge badge--success">Active</span> : <span className="badge">Disabled</span>}</td>
        <td><button className="btn btn--ghost btn--sm" onClick={onEdit}>{editing ? 'Close' : manage ? 'Edit' : 'View'}</button></td>
      </tr>
      {editing && <tr><td colSpan={7} style={{ background: 'var(--surface)' }}>{children}</td></tr>}
    </>
  );
}

function ServiceForm({ brand, initial, categories, addOns, locations, media, onSubmit, onCancel }: any) {
  const s = initial ?? { bookingMode: 'DIRECT', pricingModel: 'FIXED', basePriceMinor: 0, hourlyRateMinor: 0, minDurationMin: 60, maxDurationMin: 240, durationStepMin: 30, defaultDurationMin: 60, bufferMin: 15, slotIntervalMin: 30, requiresResource: true, isActive: true, sortOrder: 0, locationIds: [], resourceIds: [], addOnIds: [] };
  const [f, setF] = useState<any>({ ...s, basePrice: String(s.basePriceMinor / 100), hourlyRate: String(s.hourlyRateMinor / 100), name: s.name ?? '', slug: s.slug ?? '', summary: s.summary ?? '', description: s.description ?? '', categoryId: s.categoryId ?? '', imageKey: s.imageKey ?? '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggle = (k: string, id: string) => setF({ ...f, [k]: f[k].includes(id) ? f[k].filter((x: string) => x !== id) : [...f[k], id] });
  const brandLocations = locations.filter((l: any) => l.brands.includes(brand));
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      brand, categoryId: f.categoryId || null, slug: f.slug, name: f.name, summary: f.summary, description: f.description,
      bookingMode: f.bookingMode, pricingModel: f.pricingModel, basePriceMinor: toMinor(f.basePrice), hourlyRateMinor: toMinor(f.hourlyRate),
      minDurationMin: Number(f.minDurationMin), maxDurationMin: Number(f.maxDurationMin), durationStepMin: Number(f.durationStepMin), defaultDurationMin: Number(f.defaultDurationMin),
      bufferMin: Number(f.bufferMin), slotIntervalMin: Number(f.slotIntervalMin), requiresResource: f.requiresResource, imageKey: f.imageKey || null, isActive: f.isActive,
      sortOrder: Number(f.sortOrder || 0), locationIds: f.locationIds, resourceIds: f.resourceIds.filter((r: string) => brandLocations.some((l: any) => f.locationIds.includes(l.id) && l.resources.some((x: any) => x.id === r))), addOnIds: f.addOnIds,
      ...(initial?.isDemo ? { isDemo: f.isDemo } : {}),
    });
  }
  const input = (k: string, label: string, props: any = {}) => <div className="field"><label htmlFor={`s-${k}`}>{label}</label><input id={`s-${k}`} className="input" value={f[k] ?? ''} onChange={set(k)} {...props} /></div>;
  return (
    <form className="stack" onSubmit={submit} style={{ padding: 'var(--space-3)' }}>
      <div className="form-row form-row--3">
        {input('name', 'Name', { required: true })}{input('slug', 'Slug', { required: true })}
        <div className="field"><label htmlFor="s-cat">Category</label><select id="s-cat" className="select" value={f.categoryId} onChange={set('categoryId')}><option value="">None</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      {input('summary', 'Summary', { required: true })}
      <div className="field"><label htmlFor="s-desc">Description</label><textarea id="s-desc" className="textarea" value={f.description} onChange={set('description')} required /></div>
      <div className="form-row form-row--3">
        <div className="field"><label htmlFor="s-bm">Booking mode</label><select id="s-bm" className="select" value={f.bookingMode} onChange={set('bookingMode')}><option value="DIRECT">Direct booking</option><option value="REQUEST">Request (staff review)</option><option value="ENQUIRY">Enquiry / quotation</option></select></div>
        <div className="field"><label htmlFor="s-pm">Pricing model</label><select id="s-pm" className="select" value={f.pricingModel} onChange={set('pricingModel')}><option value="FIXED">Fixed</option><option value="HOURLY">Hourly</option><option value="QUOTE">Quotation</option></select></div>
        <div className="field"><label htmlFor="s-img">Image</label><select id="s-img" className="select" value={f.imageKey} onChange={set('imageKey')}><option value="">None</option>{media.map((m: any) => <option key={m.key} value={m.key}>{m.key}</option>)}</select></div>
      </div>
      <div className="form-row form-row--3">
        {input('basePrice', 'Fixed price (₹)', { inputMode: 'decimal' })}{input('hourlyRate', 'Hourly rate (₹)', { inputMode: 'decimal' })}{input('sortOrder', 'Sort order', { inputMode: 'numeric' })}
      </div>
      <div className="form-row form-row--3">
        {input('minDurationMin', 'Min duration (min)')}{input('maxDurationMin', 'Max duration (min)')}{input('durationStepMin', 'Duration step (min)')}
        {input('defaultDurationMin', 'Default duration (min)')}{input('bufferMin', 'Turnaround buffer (min)')}{input('slotIntervalMin', 'Slot interval (min)')}
      </div>
      <div className="cluster">
        <label className="checkbox"><input type="checkbox" checked={f.isActive} onChange={set('isActive')} /><span>Enabled on website</span></label>
        <label className="checkbox"><input type="checkbox" checked={f.requiresResource} onChange={set('requiresResource')} /><span>Requires an exclusive resource</span></label>
        {initial?.isDemo !== undefined && <label className="checkbox"><input type="checkbox" checked={!!f.isDemo} onChange={set('isDemo')} /><span>Label as sample content</span></label>}
      </div>
      <fieldset><legend className="label">Locations &amp; resources</legend>
        {brandLocations.map((l: any) => (
          <div key={l.id} style={{ marginBottom: 'var(--space-2)' }}>
            <label className="checkbox"><input type="checkbox" checked={f.locationIds.includes(l.id)} onChange={() => toggle('locationIds', l.id)} /><span><strong>{l.name}</strong></span></label>
            {f.locationIds.includes(l.id) && <div className="cluster" style={{ marginLeft: 32 }}>{l.resources.map((r: any) => <label key={r.id} className="checkbox small"><input type="checkbox" checked={f.resourceIds.includes(r.id)} onChange={() => toggle('resourceIds', r.id)} /><span>{r.name}</span></label>)}</div>}
          </div>
        ))}
      </fieldset>
      <fieldset><legend className="label">Add-ons</legend><div className="cluster">{addOns.map((a: any) => <label key={a.id} className="checkbox small"><input type="checkbox" checked={f.addOnIds.includes(a.id)} onChange={() => toggle('addOnIds', a.id)} /><span>{a.name}</span></label>)}</div></fieldset>
      <div className="cluster"><button className="btn" type="submit">Save service</button><button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function Packages({ service, manage, save }: any) {
  return (
    <div style={{ padding: 'var(--space-3)' }}>
      <h3 style={{ fontSize: '1rem' }}>Packages</h3>
      <SimpleList rows={service.packages} manage={manage}
        fields={[['name', 'Name'], ['slug', 'Slug'], ['description', 'Description'], ['includes', 'Includes (comma-separated)'], ['price', 'Price (₹)'], ['durationMin', 'Duration (min)']]}
        toForm={(p: any) => ({ name: p.name, slug: p.slug, description: p.description, includes: p.includes.join(', '), price: String(p.priceMinor / 100), durationMin: String(p.durationMin), isActive: p.isActive })}
        render={(p: any) => <>{p.name} · {formatMoney(p.priceMinor)} · {p.durationMin} min{!p.isActive && ' · inactive'}</>}
        onSave={(id: string | null, f: any) => save(id ? `/api/v1/admin/packages/${id}` : '/api/v1/admin/packages', id ? 'PUT' : 'POST', { serviceId: service.id, name: f.name, slug: f.slug, description: f.description, includes: f.includes.split(',').map((x: string) => x.trim()).filter(Boolean), priceMinor: toMinor(f.price), durationMin: Number(f.durationMin), isActive: f.isActive ?? true }, 'Package saved.')} />
    </div>
  );
}

/** Compact list with inline add/edit forms. */
function SimpleList({ rows, fields, toForm, render, onSave, manage }: { rows: any[]; fields: [string, string][]; toForm: (r: any) => any; render: (r: any) => React.ReactNode; onSave: (id: string | null, f: any) => Promise<boolean>; manage: boolean }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const open = (id: string | null, f: any) => { setEdit(id ?? 'new'); setForm(f); };
  const formEl = (id: string | null) => (
    <form className="stack" style={{ padding: 'var(--space-3)', background: 'var(--surface)', borderRadius: 'var(--radius)' }} onSubmit={async (e) => { e.preventDefault(); if (await onSave(id, form)) setEdit(null); }}>
      <div className="form-row form-row--3">{fields.map(([k, l]) => <div key={k} className="field"><label htmlFor={`sl-${k}`}>{l}</label><input id={`sl-${k}`} className="input" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>)}</div>
      <label className="checkbox"><input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span>Active</span></label>
      <div className="cluster"><button className="btn btn--sm" type="submit">Save</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>Cancel</button></div>
    </form>
  );
  return (
    <div className="stack">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: 'var(--space-2) 0' }}>
            <div className="cluster" style={{ justifyContent: 'space-between' }}><span>{render(r)}</span>{manage && <button className="btn btn--ghost btn--sm" onClick={() => edit === r.id ? setEdit(null) : open(r.id, toForm(r))}>Edit</button>}</div>
            {edit === r.id && formEl(r.id)}
          </li>
        ))}
        {!rows.length && <li className="muted small">None yet.</li>}
      </ul>
      {manage && (edit === 'new' ? formEl(null) : <div><button className="btn btn--ghost btn--sm" onClick={() => open(null, {})}>Add</button></div>)}
    </div>
  );
}
