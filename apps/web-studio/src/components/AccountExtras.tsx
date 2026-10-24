'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@studio/ui';

export interface SavedItem {
  id: string;
  slug: string;
  name: string;
  summary: string;
}

export function SavedServices({ initial }: { initial: SavedItem[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  async function remove(id: string) {
    const r = await api(`/api/v1/me/saved/${id}`, { method: 'DELETE' });
    if (r.ok) setItems((cur) => cur.filter((i) => i.id !== id));
    else setError(r.error.message);
  }
  return (
    <section className="st-panel stack" aria-labelledby="saved-title">
      <h2 id="saved-title" style={{ fontSize: 'var(--step-1)', margin: 0 }}>Saved services</h2>
      {error && <p className="field-error" role="alert">{error}</p>}
      {items.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {items.map((s) => (
            <li key={s.id} className="cluster" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
              <span><Link href={`/service/${s.slug}`} style={{ fontWeight: 700 }}>{s.name}</Link><span className="small muted" style={{ display: 'block' }}>{s.summary}</span></span>
              <span className="cluster">
                <Link className="btn btn--sm" href={`/service/${s.slug}#book`}>Book</Link>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(s.id)}>Remove<span className="visually-hidden"> {s.name}</span></button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0 }}>Nothing saved yet. Tap ♡ on any service to keep it here.</p>
      )}
    </section>
  );
}

export function NotificationPreferences({ initial, whatsappAvailable }: { initial: { notifyEmail: boolean; notifyWhatsapp: boolean; whatsappConsentAt: string | null }; whatsappAvailable: boolean }) {
  const [p, setP] = useState(initial);
  const [consent, setConsent] = useState(!!initial.whatsappConsentAt);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api<typeof initial>('/api/v1/me/preferences', { method: 'PATCH', body: { notifyEmail: p.notifyEmail, notifyWhatsapp: p.notifyWhatsapp, whatsappConsent: p.notifyWhatsapp ? consent : undefined } });
    setBusy(false);
    if (r.ok) {
      setP(r.data);
      setStatus({ ok: true, text: 'Preferences saved.' });
    } else setStatus({ ok: false, text: r.error.message });
  }

  return (
    <form className="st-panel stack" aria-labelledby="prefs-title" onSubmit={save}>
      <h2 id="prefs-title" style={{ fontSize: 'var(--step-1)', margin: 0 }}>Notification preferences</h2>
      <p className="small muted" style={{ margin: 0 }}>Booking confirmations and payment receipts are always sent by email. These settings control reminders and updates.</p>
      <label className="checkbox">
        <input type="checkbox" checked={p.notifyEmail} onChange={(e) => setP({ ...p, notifyEmail: e.target.checked })} />
        <span>Email reminders and booking updates</span>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={p.notifyWhatsapp} onChange={(e) => setP({ ...p, notifyWhatsapp: e.target.checked })} />
        <span>WhatsApp reminders and updates</span>
      </label>
      {p.notifyWhatsapp && (
        <label className="checkbox" style={{ marginLeft: 'var(--space-5)' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="small">I agree to receive WhatsApp messages about my bookings at the phone number on my profile.</span>
        </label>
      )}
      {!whatsappAvailable && <p className="small muted" style={{ margin: 0 }}>WhatsApp delivery is not connected on this demo yet; your choice is saved and will apply once it is.</p>}
      {status && <p className={status.ok ? 'alert alert--success small' : 'field-error'} role="status">{status.text}</p>}
      <div><button className="btn btn--sm" type="submit" disabled={busy}>Save preferences</button></div>
    </form>
  );
}
