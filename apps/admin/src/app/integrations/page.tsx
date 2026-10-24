'use client';

import { useState } from 'react';
import { formatDateTime } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TONE: Record<string, string> = { CONNECTED_VERIFIED: 'success', ERROR: 'danger', AWAITING_CREDENTIALS: 'warning', CONFIGURED_NOT_VERIFIED: 'warning', NOT_CONFIGURED: '' };

export default function IntegrationsPage() {
  const can = useCan();
  const { data, error, reload } = useAdminData<any[]>('/api/v1/admin/integrations');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="stack">
      <h1>Integrations</h1>
      <p className="muted small">States are computed from server configuration and recorded live checks. Credentials are stored only in server environment variables and are never shown here.</p>
      {msg && <div className="alert alert--info" role="status">{msg}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Integration</th><th>State</th><th>Missing settings</th><th>Fallback behaviour</th><th></th></tr></thead>
          <tbody>{data.map((i) => (
            <tr key={i.key}>
              <td><strong>{i.name}</strong><div className="small muted">{i.category}</div></td>
              <td><span className={`badge ${TONE[i.state] ? `badge--${TONE[i.state]}` : ''}`}>{i.label}</span>{i.lastCheckedAt && <div className="small muted">checked {formatDateTime(i.lastCheckedAt, 'Asia/Kolkata')}</div>}{i.message && <div className="small">{i.message}</div>}</td>
              <td className="small mono">{i.missing.join(', ') || '—'}</td>
              <td className="small">{i.fallback}</td>
              <td>{can('settings.manage') && i.verifiable && i.missing.length === 0 && (
                <button className="btn btn--sm" onClick={async () => { const r = await mutate(`/api/v1/admin/integrations/${i.key}/verify`, 'POST'); setMsg(r.ok ? `${i.name}: ${(r.data as any).label}` : errorText(r.error)); reload(); }}>Verify now</button>
              )}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
