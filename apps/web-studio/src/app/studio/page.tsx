import type { Metadata } from 'next';
import { LocationCard, PageHeader } from '@studio/ui';
import { getLocations, getSiteConfig, serverApi } from '@studio/ui/server';
import type { StudioHome } from '../../lib/types';
import { BRAND, HOME_BRANDS } from '../../site';

export const metadata: Metadata = { title: 'Studio & equipment' };

export default async function Page() {
  const [home, site, ...lists] = await Promise.all([serverApi<StudioHome>('/api/v1/studio/home'), getSiteConfig(BRAND), ...HOME_BRANDS.map(getLocations)]);
  const locations = [...new Map(lists.flat().map((l) => [l.id, l])).values()];
  const equipment = home?.equipment ?? [];
  const groups = [...new Set(equipment.map((e) => e.category))];
  return (
    <>
      <PageHeader eyebrow="Studio" title="Studios, rooms and equipment" lead="Where sessions take place and the kit available for them." />
      <section className="section section--tight">
        <div className="container stack-lg">
          <section aria-labelledby="locs">
            <h2 id="locs" style={{ fontSize: 'var(--step-2)' }}>Locations</h2>
            <div className="grid grid--2">
              {locations.map((l) => <LocationCard key={l.id} location={l} mapsKey={site.integrations.mapsEmbedKey} resourceLabel="Rooms" />)}
            </div>
            {locations.length === 0 && <div className="empty">No locations published yet.</div>}
          </section>
          <section aria-labelledby="kit">
            <h2 id="kit" style={{ fontSize: 'var(--step-2)' }}>Equipment</h2>
            {equipment.some((e) => !e.isVerified) && (
              <p className="alert alert--info">Items marked &ldquo;awaiting verification&rdquo; are generic placeholders. The studio will confirm exact makes and models before launch; nothing here is a claim about specific brands.</p>
            )}
            {groups.map((g) => (
              <div key={g} style={{ marginBottom: 'var(--space-5)' }}>
                <h3 style={{ fontSize: 'var(--step-1)' }}>{g}</h3>
                <ul className="grid grid--3" style={{ listStyle: 'none', padding: 0 }}>
                  {equipment.filter((e) => e.category === g).map((e) => (
                    <li key={e.id} className="st-panel" style={{ padding: 'var(--space-4)' }}>
                      <strong>{e.name}</strong>
                      {e.description && <span className="small muted" style={{ display: 'block' }}>{e.description}</span>}
                      {!e.isVerified && <span className="badge badge--demo" style={{ marginTop: 'var(--space-2)' }}>Awaiting verification</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {equipment.length === 0 && <div className="empty">Equipment will be listed once the studio confirms it.</div>}
          </section>
        </div>
      </section>
    </>
  );
}
