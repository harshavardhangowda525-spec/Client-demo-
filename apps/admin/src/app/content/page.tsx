'use client';

import { useState } from 'react';
import { formatDateTime } from '@studio/ui';
import { errorText, mutate, useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ContentPage() {
  const [tab, setTab] = useState<'messages' | 'portfolio' | 'faqs'>('messages');
  return (
    <div className="stack">
      <h1>Content &amp; messages</h1>
      <div className="filters" role="tablist">
        {(['messages', 'portfolio', 'faqs'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className="chip" onClick={() => setTab(t)}>{t === 'messages' ? 'Contact messages' : t === 'portfolio' ? 'Portfolio & galleries' : 'FAQs'}</button>)}
      </div>
      {tab === 'messages' && <Messages />}
      {tab === 'portfolio' && <Portfolio />}
      {tab === 'faqs' && <Faqs />}
    </div>
  );
}

function Messages() {
  const { data, reload } = useAdminData<any[]>('/api/v1/admin/contact-messages');
  if (!data) return <p className="muted">Loading…</p>;
  if (!data.length) return <div className="empty">No contact messages yet.</div>;
  return (
    <div className="stack">
      {data.map((m) => (
        <article key={m.id} className="panel">
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <strong>{m.subject}</strong>
            <select aria-label="Status" className="select" style={{ width: 'auto' }} value={m.status} onChange={async (e) => { await mutate(`/api/v1/admin/contact-messages/${m.id}`, 'PATCH', { status: e.target.value }); reload(); }}>
              <option value="NEW">New</option><option value="IN_PROGRESS">In progress</option><option value="CLOSED">Closed</option>
            </select>
          </div>
          <p className="small muted">{m.name} · <a href={`mailto:${m.email}`}>{m.email}</a>{m.phone ? ` · ${m.phone}` : ''} · {m.brand.toLowerCase()} · {formatDateTime(m.createdAt, 'Asia/Kolkata')}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{m.message}</p>
        </article>
      ))}
    </div>
  );
}

function Portfolio() {
  const { data, reload } = useAdminData<any[]>('/api/v1/admin/portfolio');
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) return <p className="muted">Loading…</p>;
  async function update(p: any, patch: object) {
    const body = { brand: p.brand, slug: p.slug, title: p.title, categoryId: p.categoryId, summary: p.summary, body: p.body, coverImage: p.coverImage, coverAlt: p.coverAlt, isSample: p.isSample, isPublished: p.isPublished, sortOrder: p.sortOrder, images: p.images.map((i: any) => ({ imageKey: i.imageKey, alt: i.alt, caption: i.caption })), ...patch };
    const r = await mutate(`/api/v1/admin/portfolio/${p.id}`, 'PUT', body);
    setMsg(r.ok ? 'Saved.' : errorText(r.error));
    reload();
  }
  return (
    <div className="stack">
      {msg && <div className="alert alert--info">{msg}</div>}
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Project</th><th>Website</th><th>Images</th><th>Published</th><th>Sample</th><th /></tr></thead>
        <tbody>{data.map((p) => (
          <tr key={p.id}>
            <td><EditableTitle p={p} onSave={(title, summary) => update(p, { title, summary })} /></td>
            <td>{p.brand.toLowerCase()}</td><td>{p.images.length}</td>
            <td><input type="checkbox" aria-label={`Published: ${p.title}`} checked={p.isPublished} onChange={(e) => update(p, { isPublished: e.target.checked })} /></td>
            <td><input type="checkbox" aria-label={`Sample: ${p.title}`} checked={p.isSample} onChange={(e) => update(p, { isSample: e.target.checked })} /></td>
            <td><button className="btn btn--ghost btn--sm" onClick={async () => { if (confirm(`Delete ${p.title}?`)) { await mutate(`/api/v1/admin/portfolio/${p.id}`, 'DELETE'); reload(); } }}>Delete</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <p className="small muted">Only mark a project as non-sample once it shows real, approved client work.</p>
    </div>
  );
}

function EditableTitle({ p, onSave }: { p: any; onSave: (t: string, s: string) => void }) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(p.title);
  const [s, setS] = useState(p.summary);
  if (!open) return <button className="btn btn--ghost btn--sm" style={{ border: 0, padding: 0 }} onClick={() => setOpen(true)}>{p.title}</button>;
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(t, s); setOpen(false); }}>
      <input aria-label="Title" className="input" value={t} onChange={(e) => setT(e.target.value)} />
      <textarea aria-label="Summary" className="textarea" value={s} onChange={(e) => setS(e.target.value)} />
      <div className="cluster"><button className="btn btn--sm">Save</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

function Faqs() {
  const { data, reload } = useAdminData<any[]>('/api/v1/admin/faqs');
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div className="stack">
      {msg && <div className="alert alert--info">{msg}</div>}
      <div><button className="btn btn--sm" onClick={() => setForm({ brand: 'PHOTO', question: '', answer: '', sortOrder: 99, isActive: true })}>New FAQ</button></div>
      {form && (
        <form className="panel stack" onSubmit={async (e) => { e.preventDefault(); const { id, ...body } = form; const r = await mutate(id ? `/api/v1/admin/faqs/${id}` : '/api/v1/admin/faqs', id ? 'PUT' : 'POST', body); setMsg(r.ok ? 'FAQ saved.' : errorText(r.error)); if (r.ok) { setForm(null); reload(); } }}>
          <label className="field">Website<select className="select" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}><option>PHOTO</option><option>PODCAST</option><option>EVENTS</option></select></label>
          <label className="field">Question<input className="input" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} required /></label>
          <label className="field">Answer<textarea className="textarea" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} required /></label>
          <div className="cluster"><button className="btn btn--sm">Save</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      <table className="table"><tbody>{data.map((f) => (
        <tr key={f.id}><td className="small">{f.brand.toLowerCase()}</td><td><strong>{f.question}</strong><div className="small muted">{f.answer}</div></td><td>{f.isDemo && <span className="badge badge--demo">Sample</span>}</td>
          <td className="cluster"><button className="btn btn--ghost btn--sm" onClick={() => setForm({ id: f.id, brand: f.brand, question: f.question, answer: f.answer, sortOrder: f.sortOrder, isActive: f.isActive })}>Edit</button>
            <button className="btn btn--ghost btn--sm" onClick={async () => { if (confirm('Delete this FAQ?')) { await mutate(`/api/v1/admin/faqs/${f.id}`, 'DELETE'); reload(); } }}>Delete</button></td></tr>
      ))}</tbody></table>
    </div>
  );
}
