'use client';

import { useState } from 'react';
import { errorText, mutate, useAdmin, useAdminData } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function UsersPage() {
  const me = useAdmin();
  const { data, error, reload } = useAdminData<{ users: any[]; roles: any[] }>('/api/v1/admin/users');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  async function update(id: string, body: object) {
    const r = await mutate(`/api/v1/admin/users/${id}`, 'PATCH', body);
    setMsg(r.ok ? { tone: 'success', text: 'User updated. Their sessions were signed out.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
    reload();
  }
  return (
    <div className="stack">
      <h1>Staff &amp; roles</h1>
      <p className="muted small">New staff register on any website, then an administrator assigns their role here. Role changes and deactivation end the user&rsquo;s active sessions.</p>
      {msg && <div className={`alert alert--${msg.tone}`}>{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && (
        <>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>{data.users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}<div className="small muted">{u.email}</div></td>
                <td>{u.id === me.id ? u.role : (
                  <select aria-label={`Role for ${u.email}`} className="select" value={u.role} onChange={(e) => update(u.id, { role: e.target.value })}>
                    {data.roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </select>
                )}</td>
                <td>{u.id === me.id ? 'You' : (
                  <button className={u.isActive ? 'btn btn--ghost btn--sm' : 'btn btn--sm'} onClick={() => update(u.id, { isActive: !u.isActive })}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <section className="panel">
            <h2>Role permissions</h2>
            <table className="table"><tbody>{data.roles.map((r) => (
              <tr key={r.key}><td><strong>{r.name}</strong><div className="small muted">{r.description}</div></td><td className="small mono">{r.permissions.join(', ') || '—'}</td></tr>
            ))}</tbody></table>
          </section>
        </>
      )}
    </div>
  );
}
