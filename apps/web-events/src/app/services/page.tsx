import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, priceFrom } from '@studio/ui';
import { getCatalog, SampleImage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Event services' };

export default async function ServicesPage() {
  const catalog = await getCatalog(BRAND);
  return (
    <>
      <PageHeader eyebrow="Services" title="Event services" lead="Full-service planning priced by tailored quotation, and planning consultations you can book directly. Sample services for the demonstration." />
      <section className="section">
        <div className="container stack-lg">
          {catalog.services.map((s, i) => (
            <article key={s.id} id={s.slug} className="split" style={{ alignItems: 'center' }}>
              <div style={i % 2 ? { order: 2 } : undefined}><SampleImage imageKey={s.imageKey} ratio="4x3" tag /></div>
              <div className="stack">
                <span className="eyebrow">{s.category?.name}</span>
                <h2>{s.name}</h2>
                <p className="lead">{s.summary}</p>
                <p>{s.description}</p>
                <p className="small"><strong>{priceFrom(s)}</strong>{s.bookingMode === 'ENQUIRY' && ' · we prepare an itemised proposal after reviewing your enquiry'}</p>
                <div className="cluster">
                  {s.bookingMode === 'ENQUIRY'
                    ? <Link className="btn" href={`/enquire?category=${s.category?.slug ?? ''}`}>Enquire about {s.name.toLowerCase()}</Link>
                    : <Link className="btn" href={`/book?service=${s.slug}`}>Book now</Link>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
