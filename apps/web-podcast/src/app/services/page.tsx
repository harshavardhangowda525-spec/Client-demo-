import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDuration, formatMoney, PageHeader, priceFrom } from '@studio/ui';
import { getCatalog, SampleImage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Recording services' };

export default async function ServicesPage() {
  const catalog = await getCatalog(BRAND);
  return (
    <>
      <PageHeader eyebrow="Services" title="Recording services" lead="Audio and video recording, multi-camera sessions, studio rental and post-production. Sample services, configurable from the admin panel." />
      {catalog.categories.map((c) => {
        const services = catalog.services.filter((s) => s.category?.id === c.id);
        if (!services.length) return null;
        return (
          <section key={c.id} className="section" aria-labelledby={`c-${c.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="container">
              <span className="eyebrow">{c.name}</span>
              <h2 id={`c-${c.id}`} style={{ fontSize: 'var(--step-2)' }}>{c.description}</h2>
              <div className="stack-lg" style={{ marginTop: 'var(--space-6)' }}>
                {services.map((s) => (
                  <article key={s.id} id={s.slug} className="split" style={{ alignItems: 'start' }}>
                    <div className="frame" data-label="sample image"><SampleImage imageKey={s.imageKey} ratio="16x9" /></div>
                    <div className="stack">
                      <h3 style={{ fontSize: 'var(--step-2)' }}>{s.name}</h3>
                      <p>{s.description}</p>
                      <div className="spec" style={{ transform: 'none' }}>
                        <div className="spec__body">
                          <div className="spec__row" style={{ borderTop: 0, paddingTop: 0 }}><span>RATE</span><strong>{priceFrom(s)}</strong></div>
                          <div className="spec__row"><span>LENGTH</span><strong>{formatDuration(s.minDurationMin)} to {formatDuration(s.maxDurationMin)}</strong></div>
                          {s.addOns.map((a) => (
                            <div key={a.id} className="spec__row"><span>+ {a.name}</span><strong>{formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? '/hr' : ''}</strong></div>
                          ))}
                        </div>
                      </div>
                      <div className="cluster"><Link className="btn" href={`/book?service=${s.slug}`}>{s.bookingMode === 'REQUEST' ? 'Request a slot' : 'Book this session'}</Link></div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
