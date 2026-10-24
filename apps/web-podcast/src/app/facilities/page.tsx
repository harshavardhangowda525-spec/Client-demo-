import type { Metadata } from 'next';
import { PageHeader } from '@studio/ui';
import { getLocations, SampleImage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Facilities & equipment' };

const CATEGORIES = ['Microphones', 'Audio interface & mixing', 'Monitoring & headphones', 'Cameras', 'Lighting', 'Acoustic treatment', 'Accessibility', 'Guest amenities'];

export default async function FacilitiesPage() {
  const locations = await getLocations(BRAND);
  return (
    <>
      <PageHeader eyebrow="Facilities" title="Facilities & equipment" lead="We only publish equipment and technical specifications that the studio has verified. Until then, this page shows the structure that verified information will fill." />
      <section className="section">
        <div className="container split" style={{ alignItems: 'start' }}>
          <div className="stack">
            <h2 style={{ fontSize: 'var(--step-2)' }}>Equipment list</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Category</th><th>Specification</th></tr></thead>
                <tbody>
                  {CATEGORIES.map((c) => (
                    <tr key={c}><td>{c}</td><td><span className="tbc">Awaiting verified details from the studio</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2 style={{ fontSize: 'var(--step-2)', marginTop: 'var(--space-6)' }}>Rooms</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Room / set</th><th>Location</th><th>Capacity</th></tr></thead>
                <tbody>
                  {locations.flatMap((l) => l.resources.map((r) => (
                    <tr key={r.id}><td>{r.name}</td><td>{l.city}</td><td className="mono">{r.capacity ?? 'TBC'}</td></tr>
                  )))}
                </tbody>
              </table>
            </div>
            <p className="small muted">Room names and capacities are demonstration data. Dimensions are intentionally omitted until verified.</p>
          </div>
          <div className="stack">
            <div className="frame" data-label="DESK · sample image"><SampleImage imageKey="podcast-control" ratio="4x3" /></div>
            <div className="frame" data-label="BOOTH · sample image"><SampleImage imageKey="podcast-booth" ratio="4x3" /></div>
          </div>
        </div>
      </section>
    </>
  );
}
