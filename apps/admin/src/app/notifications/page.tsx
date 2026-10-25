'use client';

import { useState } from 'react';
import { formatDateTime } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LABEL: Record<string, string> = {
  PREVIEW_ONLY: 'Preview only (not sent)',
  QUEUED: 'Queued',
  ACCEPTED: 'Accepted by provider (delivery not confirmed)',
  DELIVERED: 'Delivered (provider confirmed)',
  FAILED: 'Failed',
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<'log' | 'templates'>('log');
  return (
    <div className="stack">
      <h1>Notifications</h1>
      <div className="filters" role="tablist" aria-label="Notification views">
        <button role="tab" aria-selected={tab === 'log'} className="chip" onClick={() => setTab('log')}>Sent &amp; previews</button>
        <button role="tab" aria-selected={tab === 'templates'} className="chip" onClick={() => setTab('templates')}>Templates</button>
      </div>
      {tab === 'log' ? <Log /> : <Templates />}
    </div>
  );
}

function Templates() {
  const can = useCan();
  const { data, error, reload } = useAdminData<any[]>('/api/v1/admin/templates');
  const [edit, setEdit] = useState<any>(null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const manage = can('settings.manage');
  if (error) return <div className="alert alert--danger">{error.message}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>Edit the wording of customer and staff messages. Use only the placeholders listed for each template, written like <span className="mono">{'{{customerName}}'}</span>; unknown placeholders are rejected. Booking details (times, prices, links) are always filled in by the system.</p>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {data.map((t) => (
        <section key={t.key} className="panel">
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span><strong>{t.description}</strong> <span className="small muted mono">{t.key}</span> {t.isCustomised && <span className="badge badge--accent">Customised</span>}{!t.isActive && <span className="badge">Disabled</span>}</span>
            {manage && <button className="btn btn--ghost btn--sm" onClick={() => setEdit(edit?.key === t.key ? null : { key: t.key, subject: t.subject, body: t.body, isActive: t.isActive })}>{edit?.key === t.key ? 'Close' : 'Edit'}</button>}
          </div>
          <p className="small muted" style={{ margin: 'var(--space-2) 0 0' }}>Placeholders: {t.variables.map((v: string) => <span key={v} className="mono">{`{{${v}}}`} </span>)}</p>
          {edit?.key === t.key ? (
            <form className="stack" style={{ marginTop: 'var(--space-3)' }} onSubmit={async (e) => {
              e.preventDefault();
              const r = await mutate(`/api/v1/admin/templates/${t.key}`, 'PUT', { subject: edit.subject, body: edit.body, isActive: edit.isActive });
              setMsg(r.ok ? { tone: 'success', text: 'Template saved. New messages use it from now on.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
              if (r.ok) { setEdit(null); reload(); }
            }}>
              <div className="field"><label htmlFor={`ts-${t.key}`}>Subject</label><input id={`ts-${t.key}`} className="input" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></div>
              <div className="field"><label htmlFor={`tb-${t.key}`}>Body</label><textarea id={`tb-${t.key}`} className="textarea" style={{ minHeight: 180 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
              <label className="checkbox"><input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /><span>Use this custom wording (untick to fall back to the default)</span></label>
              <div className="cluster">
                <button className="btn btn--sm" type="submit">Save template</button>
                {t.isCustomised && <button type="button" className="btn btn--ghost btn--sm" onClick={async () => { const r = await mutate(`/api/v1/admin/templates/${t.key}`, 'DELETE'); setMsg(r.ok ? { tone: 'success', text: 'Reset to the default wording.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' }); setEdit(null); reload(); }}>Reset to default</button>}
              </div>
            </form>
          ) : (
            <details style={{ marginTop: 'var(--space-2)' }}><summary className="small">Preview wording</summary><p className="small"><strong>{t.subject}</strong></p><pre className="small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)' }}>{t.body}</pre></details>
          )}
        </section>
      ))}
    </div>
  );
}

function Log() {
  const { data, error } = useAdminData<{ total: number; previewsEnabled: boolean; items: any[] }>('/api/v1/admin/notifications');
  return (
    <div className="stack">
      <div className="alert alert--info"><p>When no email/SMS/WhatsApp provider is configured, messages are stored here as <strong>previews</strong> and are not sent. A message is never reported as delivered unless the provider confirms it.</p></div>
      {data && !data.previewsEnabled && <div className="alert alert--warning">Message bodies are hidden outside development preview mode.</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (data.items.length ? data.items.map((n) => (
        <details key={n.id} className="panel">
          <summary style={{ cursor: 'pointer' }}>
            <strong>{n.subject ?? n.template}</strong> <span className="small muted">→ {n.recipient} · {n.channel.toLowerCase()} · {formatDateTime(n.createdAt, 'Asia/Kolkata')}</span> <span className={`badge ${n.status === 'FAILED' ? 'badge--danger' : n.status === 'PREVIEW_ONLY' ? 'badge--demo' : ''}`}>{LABEL[n.status]}</span>
          </summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', marginTop: 'var(--space-3)' }}>{n.body}</pre>
          {n.error && <p className="field-error">{n.error}</p>}
        </details>
      )) : <div className="empty">No notifications yet.</div>)}
    </div>
  );
}
