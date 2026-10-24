'use client';

import { useState, type FormEvent } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LABEL = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/Bps$/, ' (basis points, 100 = 1%)').replace(/Minor$/, ' (paise)');

function Field({ path, value, onChange, disabled }: { path: string; value: any; onChange: (v: any) => void; disabled?: boolean }) {
  const key = path.split('.').pop()!;
  const id = `f-${path}`;
  if (typeof value === 'boolean') {
    return <label className="checkbox"><input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span>{LABEL(key)}</span></label>;
  }
  if (typeof value === 'number') {
    return <div className="field"><label htmlFor={id}>{LABEL(key)}</label><input id={id} className="input" type="number" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} /></div>;
  }
  if (Array.isArray(value)) {
    return <JsonField id={id} label={`${LABEL(key)} (JSON)`} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (value && typeof value === 'object') {
    return (
      <fieldset className="panel" style={{ padding: 'var(--space-4)' }}>
        <legend className="label">{LABEL(key)}</legend>
        <div className="form-row form-row--2">
          {Object.entries(value).map(([k, v]) => <Field key={k} path={`${path}.${k}`} value={v} disabled={disabled} onChange={(nv) => onChange({ ...value, [k]: nv })} />)}
        </div>
      </fieldset>
    );
  }
  const long = typeof value === 'string' && value.length > 80;
  return (
    <div className="field" style={long ? { gridColumn: '1 / -1' } : undefined}>
      <label htmlFor={id}>{LABEL(key)}</label>
      {long ? <textarea id={id} className="textarea" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} /> : <input id={id} className="input" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

function JsonField({ id, label, value, onChange, disabled }: { id: string; label: string; value: any; onChange: (v: any) => void; disabled?: boolean }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="field" style={{ gridColumn: '1 / -1' }}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="textarea mono" value={text} disabled={disabled} onChange={(e) => {
        setText(e.target.value);
        try { onChange(JSON.parse(e.target.value)); setErr(null); } catch { setErr('Invalid JSON'); }
      }} />
      {err && <p className="field-error">{err}</p>}
    </div>
  );
}

/** Renders inputs for a plain settings object; the server validates on save. */
export function ObjectForm({ initial, onSave, disabled }: { initial: Record<string, any>; onSave: (v: Record<string, any>) => Promise<void>; disabled?: boolean }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSave(value);
    setBusy(false);
  }
  return (
    <form className="stack" onSubmit={submit}>
      <div className="form-row form-row--2">
        {Object.entries(value).map(([k, v]) => <Field key={k} path={k} value={v} disabled={disabled} onChange={(nv) => setValue({ ...value, [k]: nv })} />)}
      </div>
      {!disabled && <div><button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>}
    </form>
  );
}
