'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RecordEditor } from '../../components/RecordEditor';
import { errorText, mutate, useAdminData, useCan } from '../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TABS = [
  ['banners', 'Home banners'],
  ['categories', 'Browse categories'],
  ['equipment', 'Equipment & facilities'],
  ['testimonials', 'Testimonials'],
  ['pages', 'Policy pages'],
] as const;

// Blank optional fields are sent as null; datetime-local values become ISO timestamps.
const clean = (f: Record<string, any>, dates: string[] = []) =>
  Object.fromEntries(Object.entries(f).filter(([k]) => !['id', 'createdAt', 'updatedAt', '_count', 'service'].includes(k)).map(([k, v]) => [k, v === '' ? null : dates.includes(k) && v ? new Date(v).toISOString() : v]));
const localInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function StudioSitePage() {
  const can = useCan();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('banners');
  const { data: media } = useAdminData<any[]>('/api/v1/admin/media');
  const { data: catalog } = useAdminData<any>('/api/v1/admin/catalog');
  const images = (media ?? []).map((m) => ({ value: m.key, label: m.key }));
  const services = (catalog?.services ?? []).filter((s: any) => s.brand !== 'EVENTS').map((s: any) => ({ value: s.id, label: s.name }));

  return (
    <div className="stack">
      <div>
        <h1>Studio site</h1>
        <p className="muted small">Content for the Infinity Studios discovery site. Site name, tagline, email and social links are under <Link href="/settings">Configuration → siteContent → STUDIO</Link>; which services appear in each category is set on each service.</p>
      </div>
      <div className="filters" role="tablist" aria-label="Studio site sections">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="chip" onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'banners' && (
        <section className="panel stack">
          <p className="small muted" style={{ margin: 0 }}>Shown in the home carousel in sort order. Use &ldquo;Offer text&rdquo; only for offers the business has approved.</p>
          <RecordEditor
            path="/api/v1/admin/banners"
            manage={can('content.manage')}
            canDelete
            empty={{ title: '', subtitle: '', imageKey: '', imageAlt: '', ctaLabel: '', ctaHref: '/services', offerText: '', sortOrder: 0, isActive: true, startsAt: '', endsAt: '' }}
            fields={[
              { key: 'title', label: 'Title', required: true },
              { key: 'subtitle', label: 'Subtitle' },
              { key: 'imageKey', label: 'Image', type: 'select', options: images, required: true },
              { key: 'imageAlt', label: 'Image description (alt text)', required: true },
              { key: 'ctaLabel', label: 'Button label', required: true },
              { key: 'ctaHref', label: 'Button link', hint: 'A site path such as /services/podcasting, or an https:// link', required: true },
              { key: 'offerText', label: 'Offer text (optional)' },
              { key: 'sortOrder', label: 'Sort order', type: 'number' },
              { key: 'startsAt', label: 'Show from (optional)', type: 'datetime' },
              { key: 'endsAt', label: 'Show until (optional)', type: 'datetime' },
              { key: 'isActive', label: 'Active', type: 'checkbox' },
            ]}
            toForm={(r) => ({ ...r, subtitle: r.subtitle ?? '', offerText: r.offerText ?? '', startsAt: localInput(r.startsAt), endsAt: localInput(r.endsAt) })}
            fromForm={(f) => ({ ...clean(f, ['startsAt', 'endsAt']), sortOrder: Number(f.sortOrder || 0) })}
            render={(r) => <><strong>{r.title}</strong> {!r.isActive && <span className="badge">Inactive</span>}{r.offerText && <span className="badge badge--accent">{r.offerText}</span>}<div className="small muted">{r.ctaLabel} → {r.ctaHref} · {r.imageKey}</div></>}
          />
        </section>
      )}

      {tab === 'categories' && (
        <section className="panel stack">
          <p className="small muted" style={{ margin: 0 }}>Categories appear in the category bar and home tiles. Assign services to them on the Services page.</p>
          <RecordEditor
            path="/api/v1/admin/discovery-categories"
            manage={can('content.manage')}
            empty={{ name: '', slug: '', description: '', imageKey: '', sortOrder: 0, isActive: true }}
            fields={[
              { key: 'name', label: 'Name', required: true },
              { key: 'slug', label: 'URL slug', hint: '/services/<slug>', required: true },
              { key: 'description', label: 'Description', type: 'textarea' },
              { key: 'imageKey', label: 'Image', type: 'select', options: images },
              { key: 'sortOrder', label: 'Sort order', type: 'number' },
              { key: 'isActive', label: 'Active', type: 'checkbox' },
            ]}
            toForm={(r) => ({ ...r, description: r.description ?? '', imageKey: r.imageKey ?? '' })}
            fromForm={(f) => ({ ...clean(f), sortOrder: Number(f.sortOrder || 0) })}
            render={(r) => <><strong>{r.name}</strong> <span className="small muted">/services/{r.slug} · {r._count?.services ?? 0} services</span> {!r.isActive && <span className="badge">Inactive</span>}{r.isDemo && <span className="badge badge--demo">Sample</span>}</>}
          />
        </section>
      )}

      {tab === 'equipment' && (
        <section className="panel stack">
          <p className="small muted" style={{ margin: 0 }}>Tick &ldquo;Verified by the studio&rdquo; only once exact makes and models are confirmed. Unverified items show an &ldquo;Awaiting verification&rdquo; label on the website.</p>
          <RecordEditor
            path="/api/v1/admin/equipment"
            manage={can('catalog.manage')}
            empty={{ name: '', category: '', description: '', imageKey: '', isVerified: false, isActive: true, sortOrder: 0 }}
            fields={[
              { key: 'name', label: 'Name', required: true },
              { key: 'category', label: 'Group', hint: 'e.g. Audio, Lighting, Studio space', required: true },
              { key: 'description', label: 'Description', type: 'textarea' },
              { key: 'imageKey', label: 'Image', type: 'select', options: images },
              { key: 'sortOrder', label: 'Sort order', type: 'number' },
              { key: 'isVerified', label: 'Verified by the studio', type: 'checkbox' },
              { key: 'isActive', label: 'Active', type: 'checkbox' },
            ]}
            toForm={(r) => ({ ...r, description: r.description ?? '', imageKey: r.imageKey ?? '' })}
            fromForm={(f) => ({ ...clean(f), sortOrder: Number(f.sortOrder || 0) })}
            render={(r) => <><strong>{r.name}</strong> <span className="small muted">{r.category} · used by {r._count?.services ?? 0} services</span> {r.isVerified ? <span className="badge badge--success">Verified</span> : <span className="badge badge--demo">Awaiting verification</span>}{!r.isActive && <span className="badge">Inactive</span>}</>}
          />
        </section>
      )}

      {tab === 'testimonials' && (
        <section className="panel stack">
          <div className="alert alert--warning small">Add only genuine feedback from real clients, with their permission. A testimonial can be published only after you confirm the client authorised it. The website hides this section while none are published.</div>
          <RecordEditor
            path="/api/v1/admin/testimonials"
            manage={can('content.manage')}
            canDelete
            empty={{ quote: '', authorName: '', authorDetail: '', serviceId: '', isAuthorized: false, isPublished: false, sortOrder: 0 }}
            fields={[
              { key: 'quote', label: 'Quote', type: 'textarea', required: true },
              { key: 'authorName', label: 'Client name', required: true },
              { key: 'authorDetail', label: 'Client detail (e.g. role, company)' },
              { key: 'serviceId', label: 'Service (optional)', type: 'select', options: services },
              { key: 'sortOrder', label: 'Sort order', type: 'number' },
              { key: 'isAuthorized', label: 'The client authorised publication', type: 'checkbox' },
              { key: 'isPublished', label: 'Published', type: 'checkbox' },
            ]}
            toForm={(r) => ({ ...r, authorDetail: r.authorDetail ?? '', serviceId: r.serviceId ?? '' })}
            fromForm={(f) => ({ ...clean(f), sortOrder: Number(f.sortOrder || 0) })}
            render={(r) => <><strong>{r.authorName}</strong>{r.service ? <span className="small muted"> · {r.service.name}</span> : null} {r.isPublished ? <span className="badge badge--success">Published</span> : <span className="badge">Draft</span>}{!r.isAuthorized && <span className="badge badge--warning">Not authorised</span>}<div className="small muted">&ldquo;{r.quote.slice(0, 140)}{r.quote.length > 140 ? '…' : ''}&rdquo;</div></>}
          />
        </section>
      )}

      {tab === 'pages' && <PolicyPages manage={can('content.manage')} />}
    </div>
  );
}

function PolicyPages({ manage }: { manage: boolean }) {
  const { data, error, reload } = useAdminData<any[]>('/api/v1/admin/pages');
  const [edit, setEdit] = useState<any>(null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  if (error) return <div className="alert alert--danger">{error.message}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <section className="panel stack">
      <p className="small muted" style={{ margin: 0 }}>Pages marked as templates show a &ldquo;template awaiting review&rdquo; notice on the website. Untick it once the business has approved the final text.</p>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      {data.map((p) => (
        <div key={p.slug} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-3)' }}>
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span><strong>{p.title}</strong> <span className="small muted">/policies/{p.slug}</span> {p.isTemplate && <span className="badge badge--demo">Template</span>}</span>
            {manage && <button className="btn btn--ghost btn--sm" onClick={() => setEdit(edit?.slug === p.slug ? null : { slug: p.slug, title: p.title, body: p.body, isTemplate: p.isTemplate })}>{edit?.slug === p.slug ? 'Close' : 'Edit'}</button>}
          </div>
          {edit?.slug === p.slug && (
            <form className="stack" style={{ marginTop: 'var(--space-3)' }} onSubmit={async (e) => {
              e.preventDefault();
              const r = await mutate(`/api/v1/admin/pages/${p.slug}`, 'PUT', { title: edit.title, body: edit.body, isTemplate: edit.isTemplate });
              setMsg(r.ok ? { tone: 'success', text: 'Page saved.' } : { tone: 'danger', text: errorText(r.error) ?? 'Failed' });
              if (r.ok) { setEdit(null); reload(); }
            }}>
              <div className="field"><label htmlFor={`pg-t-${p.slug}`}>Title</label><input id={`pg-t-${p.slug}`} className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="field"><label htmlFor={`pg-b-${p.slug}`}>Text (blank line between paragraphs)</label><textarea id={`pg-b-${p.slug}`} className="textarea" style={{ minHeight: 260 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
              <label className="checkbox"><input type="checkbox" checked={edit.isTemplate} onChange={(e) => setEdit({ ...edit, isTemplate: e.target.checked })} /><span>Still a template (not yet approved)</span></label>
              <div><button className="btn btn--sm" type="submit">Save page</button></div>
            </form>
          )}
        </div>
      ))}
    </section>
  );
}
