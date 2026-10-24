'use client';

import { useState } from 'react';
import { DAY_NAMES, formatDateTime } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const BRANDS = ['PHOTO', 'PODCAST', 'EVENTS'];

export default function LocationsPage() {
  const can = useCan();
  const manage = can('locations.manage');
  const { data, error, reload } = useAdminData<any[]>('/api/v1/admin/locations');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [newLoc, setNewLoc] = useState(false);

  async function save(path: string, method: 'POST' | 'PUT' | 'DELETE', body: object | undefined, ok: string) {
    const r = await mutate<any>(path, method, body);
    if (r.ok) {
      const conflicts = (r.data as any)?.conflicts;
      setMsg(conflicts?.length ? { tone: 'warning', text: `${ok} Note: ${conflicts.length} active booking(s) overlap this block: ${conflicts.map((c: any) => c.reference).join(', ')}. Reschedule or cancel them.` } : { tone: 'success', text: ok });
      reload();
    } else setMsg({ tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    return r.ok;
  }

  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}><h1 style={{ margin: 0 }}>Locations &amp; resources</h1>{manage && <button className="btn btn--sm" onClick={() => setNewLoc(!newLoc)}>New location</button>}</div>
      <p className="muted small">Resources are booked exclusively: the database rejects any overlapping reservation for the same resource, including turnaround buffers.</p>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {newLoc && <section className="panel"><LocationForm onSubmit={(b: any) => save('/api/v1/admin/locations', 'POST', b, 'Location created.').then((ok) => ok && setNewLoc(false))} /></section>}
      {data?.map((l) => <LocationPanel key={l.id} l={l} manage={manage} save={save} />)}
    </div>
  );
}

function LocationPanel({ l, manage, save }: any) {
  const [editing, setEditing] = useState(false);
  const [resForm, setResForm] = useState<any>(null);
  const [hours, setHours] = useState<any[]>(l.openingHours.map((h: any) => ({ dayOfWeek: h.dayOfWeek, open: h.open, close: h.close })));
  const [block, setBlock] = useState({ target: '', kind: 'MAINTENANCE', startsAt: '', endsAt: '', reason: '' });
  return (
    <section className="panel">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{l.name} {l.isDemo && <span className="badge badge--demo">Demo location</span>} {!l.isActive && <span className="badge">Inactive</span>}</h2>
        {manage && <button className="btn btn--ghost btn--sm" onClick={() => setEditing(!editing)}>{editing ? 'Close' : 'Edit details'}</button>}
      </div>
      <p className="small muted">{l.addressLine1}, {l.city} · {l.timezone} · websites: {l.brands.join(', ').toLowerCase()}</p>
      {editing && <LocationForm initial={l} onSubmit={(b: any) => save(`/api/v1/admin/locations/${l.id}`, 'PUT', b, 'Location updated.').then((ok: boolean) => ok && setEditing(false))} />}

      <div className="cols" style={{ marginTop: 'var(--space-4)' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem' }}>Resources</h3>
          <table className="table"><tbody>
            {l.resources.map((r: any) => (
              <tr key={r.id}><td>{r.name}<div className="small muted">{r.type.toLowerCase()}{r.capacity ? ` · cap. ${r.capacity}` : ''}{r.openingHours.length ? ' · custom hours' : ''}</div></td><td>{r.isActive ? 'Active' : 'Inactive'}</td><td>{manage && <button className="btn btn--ghost btn--sm" onClick={() => setResForm({ id: r.id, name: r.name, type: r.type, capacity: r.capacity ?? '', description: r.description ?? '', isActive: r.isActive })}>Edit</button>}</td></tr>
            ))}
          </tbody></table>
          {manage && !resForm && <button className="btn btn--ghost btn--sm" onClick={() => setResForm({ name: '', type: 'STUDIO', capacity: '', description: '', isActive: true })}>Add resource</button>}
          {resForm && (
            <form className="stack" style={{ marginTop: 'var(--space-3)' }} onSubmit={(e) => { e.preventDefault(); save(resForm.id ? `/api/v1/admin/resources/${resForm.id}` : '/api/v1/admin/resources', resForm.id ? 'PUT' : 'POST', { locationId: l.id, name: resForm.name, type: resForm.type, capacity: resForm.capacity ? Number(resForm.capacity) : null, description: resForm.description || null, isActive: resForm.isActive, isExclusive: true }, 'Resource saved.').then((ok: boolean) => ok && setResForm(null)); }}>
              <div className="form-row form-row--3">
                <label className="field">Name<input className="input" value={resForm.name} onChange={(e) => setResForm({ ...resForm, name: e.target.value })} required /></label>
                <label className="field">Type<select className="select" value={resForm.type} onChange={(e) => setResForm({ ...resForm, type: e.target.value })}>{['STUDIO', 'ROOM', 'EQUIPMENT', 'CREW', 'VENUE'].map((t) => <option key={t}>{t}</option>)}</select></label>
                <label className="field">Capacity<input className="input" inputMode="numeric" value={resForm.capacity} onChange={(e) => setResForm({ ...resForm, capacity: e.target.value })} /></label>
              </div>
              <label className="checkbox"><input type="checkbox" checked={resForm.isActive} onChange={(e) => setResForm({ ...resForm, isActive: e.target.checked })} /><span>Active</span></label>
              <div className="cluster"><button className="btn btn--sm">Save resource</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setResForm(null)}>Cancel</button></div>
            </form>
          )}
        </div>
        <div>
          <h3 style={{ fontSize: '0.95rem' }}>Opening hours ({l.timezone})</h3>
          <table className="table"><tbody>
            {hours.map((h, i) => (
              <tr key={i}>
                <td><select aria-label="Day" className="select" disabled={!manage} value={h.dayOfWeek} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, dayOfWeek: Number(e.target.value) } : x))}>{DAY_NAMES.map((d, k) => <option key={k} value={k}>{d}</option>)}</select></td>
                <td><input aria-label="Opens" type="time" className="input" disabled={!manage} value={h.open} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, open: e.target.value } : x))} /></td>
                <td><input aria-label="Closes" className="input" disabled={!manage} value={h.close} pattern="([01]\d|2[0-3]):[0-5]\d|24:00" onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, close: e.target.value } : x))} /></td>
                <td>{manage && <button className="btn btn--ghost btn--sm" aria-label="Remove" onClick={() => setHours(hours.filter((_, j) => j !== i))}>×</button>}</td>
              </tr>
            ))}
          </tbody></table>
          {manage && <div className="cluster"><button className="btn btn--ghost btn--sm" onClick={() => setHours([...hours, { dayOfWeek: 1, open: '09:00', close: '18:00' }])}>Add range</button><button className="btn btn--sm" onClick={() => save('/api/v1/admin/opening-hours', 'PUT', { locationId: l.id, resourceId: null, hours }, 'Opening hours saved.')}>Save hours</button></div>}
        </div>
      </div>

      <h3 style={{ fontSize: '0.95rem', marginTop: 'var(--space-5)' }}>Blocked dates &amp; maintenance</h3>
      <table className="table"><tbody>
        {l.blocks.map((b: any) => (
          <tr key={b.id}><td>{b.kind.toLowerCase()}</td><td>{b.resource?.name ?? 'Whole location'}</td><td>{formatDateTime(b.startsAt, l.timezone)} → {formatDateTime(b.endsAt, l.timezone)}</td><td className="small">{b.reason}</td><td>{manage && <button className="btn btn--ghost btn--sm" onClick={() => save(`/api/v1/admin/blocked-periods/${b.id}`, 'DELETE', undefined, 'Block removed.')}>Remove</button>}</td></tr>
        ))}
        {!l.blocks.length && <tr><td className="muted small">No upcoming blocks.</td></tr>}
      </tbody></table>
      {manage && (
        <form className="toolbar" style={{ marginTop: 'var(--space-3)' }} onSubmit={(e) => {
          e.preventDefault();
          const toUtc = (v: string) => new Date(`${v}:00+05:30`).toISOString();
          save('/api/v1/admin/blocked-periods', 'POST', { locationId: block.target ? null : l.id, resourceId: block.target || null, kind: block.kind, startsAt: toUtc(block.startsAt), endsAt: toUtc(block.endsAt), reason: block.reason || null }, 'Block added.');
        }}>
          <label className="field">Applies to<select className="select" value={block.target} onChange={(e) => setBlock({ ...block, target: e.target.value })}><option value="">Whole location</option>{l.resources.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label className="field">Type<select className="select" value={block.kind} onChange={(e) => setBlock({ ...block, kind: e.target.value })}>{['CLOSURE', 'MAINTENANCE', 'HOLD', 'OTHER'].map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field">Starts (IST)<input type="datetime-local" className="input" required value={block.startsAt} onChange={(e) => setBlock({ ...block, startsAt: e.target.value })} /></label>
          <label className="field">Ends (IST)<input type="datetime-local" className="input" required value={block.endsAt} onChange={(e) => setBlock({ ...block, endsAt: e.target.value })} /></label>
          <label className="field">Reason<input className="input" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} /></label>
          <button className="btn btn--sm">Add block</button>
        </form>
      )}
    </section>
  );
}

function LocationForm({ initial, onSubmit }: { initial?: any; onSubmit: (b: any) => void }) {
  const [f, setF] = useState<any>({
    name: initial?.name ?? '', slug: initial?.slug ?? '', brands: initial?.brands ?? ['PHOTO'], addressLine1: initial?.addressLine1 ?? '', addressLine2: initial?.addressLine2 ?? '',
    city: initial?.city ?? '', region: initial?.region ?? '', postalCode: initial?.postalCode ?? '', timezone: initial?.timezone ?? 'Asia/Kolkata', phone: initial?.phone ?? '', email: initial?.email ?? '',
    description: initial?.description ?? '', isActive: initial?.isActive ?? true, isDemo: initial?.isDemo ?? false, imageKey: initial?.imageKey ?? '',
  });
  const text = (k: string, l: string, req = false) => <label className="field">{l}<input className="input" value={f[k]} required={req} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, addressLine2: f.addressLine2 || null, region: f.region || null, postalCode: f.postalCode || null, phone: f.phone || null, email: f.email || null, description: f.description || null, imageKey: f.imageKey || null, country: 'IN' }); }}>
      <div className="form-row form-row--3">{text('name', 'Name', true)}{text('slug', 'Slug', true)}{text('timezone', 'Timezone (IANA)', true)}</div>
      <div className="form-row form-row--3">{text('addressLine1', 'Address line 1', true)}{text('addressLine2', 'Address line 2')}{text('city', 'City', true)}{text('region', 'State / region')}{text('postalCode', 'PIN code')}{text('phone', 'Phone')}</div>
      <label className="field">Description<textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="cluster">
        {BRANDS.map((b) => <label key={b} className="checkbox"><input type="checkbox" checked={f.brands.includes(b)} onChange={() => setF({ ...f, brands: f.brands.includes(b) ? f.brands.filter((x: string) => x !== b) : [...f.brands, b] })} /><span>{b.toLowerCase()}</span></label>)}
        <label className="checkbox"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /><span>Active</span></label>
        <label className="checkbox"><input type="checkbox" checked={f.isDemo} onChange={(e) => setF({ ...f, isDemo: e.target.checked })} /><span>Demonstration location (no map)</span></label>
      </div>
      <div><button className="btn btn--sm">Save location</button></div>
    </form>
  );
}
