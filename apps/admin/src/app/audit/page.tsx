'use client';

import { useState } from 'react';
import { formatDateTime } from '@studio/ui';
import { useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const { data, error } = useAdminData<{ total: number; items: any[] }>(`/api/v1/admin/audit?page=${page}${entityType ? `&entityType=${entityType}` : ''}`);
  return (
    <div className="stack">
      <h1>Audit log</h1>
      <p className="muted small">Who changed what, and when. Sensitive values such as passwords and tokens are redacted before storage.</p>
      <div className="toolbar"><div className="field"><label htmlFor="et">Record type</label>
        <select id="et" className="select" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">All</option>{['Booking', 'EventEnquiry', 'Quotation', 'PaymentOrder', 'Refund', 'Service', 'Package', 'Location', 'Resource', 'Setting', 'User', 'CustomerProfile', 'Integration'].map((t) => <option key={t}>{t}</option>)}
        </select></div></div>
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (data.items.length ? (
        <>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Record</th><th>Summary</th><th>Changes</th></tr></thead>
            <tbody>{data.items.map((a) => (
              <tr key={a.id}>
                <td className="small">{formatDateTime(a.createdAt, 'Asia/Kolkata')}</td>
                <td>{a.actor?.name ?? 'System / guest'}<div className="small muted">{a.actorRole}{a.ipAddress ? ` · ${a.ipAddress}` : ''}</div></td>
                <td className="mono small">{a.action}</td>
                <td className="small">{a.entityType}<div className="mono muted">{a.entityId}</div></td>
                <td className="small">{a.summary}</td>
                <td>{(a.before || a.after) && <details><summary className="small">View</summary><pre className="small" style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>{JSON.stringify({ before: a.before, after: a.after }, null, 2)}</pre></details>}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="cluster"><button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="small muted">Page {page}</span><button className="btn btn--ghost btn--sm" disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)}>Next</button></div>
        </>
      ) : <div className="empty">No audit entries.</div>)}
    </div>
  );
}
