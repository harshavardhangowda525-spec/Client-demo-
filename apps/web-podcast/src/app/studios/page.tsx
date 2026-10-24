import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@studio/ui';
import { getLocations, SampleImage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Studio overview' };

export default async function StudiosPage() {
  const locations = await getLocations(BRAND);
  return (
    <>
      <PageHeader eyebrow="Studios" title="Studio overview" lead="Bookable rooms and sets across our studio locations. Room names and capacities are sample data until the studio supplies verified details." />
      {locations.map((l, i) => (
        <section key={l.id} className={`section ${i % 2 ? 'section--surface' : ''}`} aria-labelledby={`l-${l.id}`}>
          <div className="container split" style={{ alignItems: 'start' }}>
            <div className="frame" data-label={`${l.city.toUpperCase()} · sample image`}><SampleImage imageKey={l.imageKey} ratio="4x3" /></div>
            <div className="stack">
              <span className="eyebrow">{l.city}</span>
              <h2 id={`l-${l.id}`}>{l.name}</h2>
              {l.description && <p className="muted">{l.description}</p>}
              <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
                {l.resources.map((r) => (
                  <div key={r.id} className="card" style={{ padding: 'var(--space-4)' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{r.name}</p>
                    <p className="small muted mono" style={{ margin: 0 }}>{r.type.toLowerCase()}{r.capacity ? ` · up to ${r.capacity}` : ''}</p>
                  </div>
                ))}
              </div>
              <div className="cluster"><Link className="btn" href={`/book?location=${l.id}`}>Book at this location</Link><Link className="btn btn--ghost" href="/locations">Address &amp; hours</Link></div>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
