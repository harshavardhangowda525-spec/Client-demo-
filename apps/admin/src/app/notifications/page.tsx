'use client';

import { formatDateTime } from '@studio/ui';
import { useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LABEL: Record<string, string> = {
  PREVIEW_ONLY: 'Preview only (not sent)',
  QUEUED: 'Queued',
  ACCEPTED: 'Accepted by provider (delivery not confirmed)',
  DELIVERED: 'Delivered (provider confirmed)',
  FAILED: 'Failed',
};

export default function NotificationsPage() {
  const { data, error } = useAdminData<{ total: number; previewsEnabled: boolean; items: any[] }>('/api/v1/admin/notifications');
  return (
    <div className="stack">
      <h1>Notifications</h1>
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
