'use client';

import { useState } from 'react';
import { ObjectForm } from '../../components/ObjectForm';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const GROUPS: { key: string; title: string; help: string }[] = [
  { key: 'business', title: 'Business details', help: 'Shown in emails and the website footers.' },
  { key: 'siteContent', title: 'Website names & contact', help: 'Brand names, taglines and public contact details for the three websites.' },
  { key: 'regional', title: 'Timezone & currency', help: 'IANA timezone (e.g. Asia/Kolkata) and ISO currency code.' },
  { key: 'bookingRules', title: 'Booking rules', help: 'Lead time, how far ahead customers can book, and how long unpaid slots are held.' },
  { key: 'pricing', title: 'Pricing, tax & deposits', help: 'Tax rate and deposit in basis points (1800 = 18%). Fees: [{"code","label","type":"PERCENT"|"FIXED","value"}].' },
  { key: 'cancellationPolicy', title: 'Cancellation policy', help: 'Shown at checkout and on booking pages.' },
];

export default function SettingsPage() {
  const can = useCan();
  const { data, error, reload } = useAdminData<Record<string, any>>('/api/v1/admin/settings');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const editable = can('settings.manage');
  return (
    <div className="stack">
      <h1>Configuration</h1>
      <p className="muted small">Changes take effect immediately on all three websites and are recorded in the audit log.{!editable && ' You have read-only access.'}</p>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {error && <div className="alert alert--danger">{error.message}</div>}
      {data && GROUPS.map((g) => (
        <section key={g.key} className="panel">
          <h2>{g.title}</h2>
          <p className="small muted">{g.help}</p>
          <ObjectForm key={JSON.stringify(data[g.key])} initial={data[g.key]} disabled={!editable} onSave={async (v) => {
            const r = await mutate(`/api/v1/admin/settings/${g.key}`, 'PUT', v);
            setMsg(r.ok ? { tone: 'success', text: `${g.title} saved.` } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
            if (r.ok) reload();
          }} />
        </section>
      ))}
    </div>
  );
}
