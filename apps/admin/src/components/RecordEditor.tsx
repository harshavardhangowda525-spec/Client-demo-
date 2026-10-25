'use client';

import { useState, type ReactNode } from 'react';
import { errorText, mutate, useAdminData } from '../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'datetime';
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
}

/**
 * List + inline create/edit form for a simple admin resource. Values are sent
 * as-is; the API validates and returns field errors, shown above the form.
 */
export function RecordEditor({ path, fields, empty, render, canDelete, manage = true, toForm = (r) => r, fromForm = (f) => f }: {
  path: string;
  fields: FieldDef[];
  empty: Record<string, any>;
  render: (r: any) => ReactNode;
  canDelete?: boolean;
  manage?: boolean;
  toForm?: (r: any) => Record<string, any>;
  fromForm?: (f: Record<string, any>) => Record<string, any>;
}) {
  const { data, error, reload } = useAdminData<any[]>(path);
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);

  async function save(id: string | null) {
    const r = await mutate(id ? `${path}/${id}` : path, id ? 'PUT' : 'POST', fromForm(form));
    setMsg(r.ok ? { tone: 'success', text: 'Saved.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    if (r.ok) {
      setEdit(null);
      reload();
    }
  }

  const formEl = (id: string | null) => (
    <form className="stack" style={{ padding: 'var(--space-4)', background: 'var(--surface)', borderRadius: 'var(--radius)' }} onSubmit={(e) => { e.preventDefault(); save(id); }}>
      <div className="form-row form-row--2">
        {fields.map((f) => {
          const fid = `re-${path.split('/').pop()}-${f.key}`;
          const v = form[f.key];
          if (f.type === 'checkbox') return <label key={f.key} className="checkbox"><input type="checkbox" checked={!!v} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} /><span>{f.label}</span></label>;
          return (
            <div key={f.key} className="field" style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
              <label htmlFor={fid}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={fid} className="textarea" value={v ?? ''} required={f.required} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : f.type === 'select' ? (
                <select id={fid} className="select" value={v ?? ''} required={f.required} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                  {!f.required && <option value="">None</option>}
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input id={fid} className="input" type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : 'text'} value={v ?? ''} required={f.required} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              )}
              {f.hint && <p className="hint">{f.hint}</p>}
            </div>
          );
        })}
      </div>
      <div className="cluster"><button className="btn btn--sm" type="submit">Save</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>Cancel</button></div>
    </form>
  );

  if (error) return <div className="alert alert--danger">{error.message}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div className="stack">
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {manage && (edit === 'new' ? formEl(null) : <div><button className="btn btn--sm" onClick={() => { setEdit('new'); setForm({ ...empty }); setMsg(null); }}>Add new</button></div>)}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {data.map((r) => (
          <li key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: 'var(--space-3) 0' }}>
            <div className="cluster" style={{ justifyContent: 'space-between' }}>
              <div>{render(r)}</div>
              {manage && (
                <div className="cluster">
                  <button className="btn btn--ghost btn--sm" onClick={() => { if (edit === r.id) setEdit(null); else { setEdit(r.id); setForm(toForm(r)); setMsg(null); } }}>{edit === r.id ? 'Close' : 'Edit'}</button>
                  {canDelete && <button className="btn btn--ghost btn--sm" onClick={async () => { if (confirm('Delete this item?')) { const d = await mutate(`${path}/${r.id}`, 'DELETE'); setMsg(d.ok ? { tone: 'success', text: 'Deleted.' } : { tone: 'danger', text: errorText(d.error) ?? 'Failed' }); reload(); } }}>Delete</button>}
                </div>
              )}
            </div>
            {edit === r.id && formEl(r.id)}
          </li>
        ))}
        {!data.length && <li className="empty">Nothing here yet.</li>}
      </ul>
    </div>
  );
}
