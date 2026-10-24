import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@studio/ui';
import { getCatalog, SampleImage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Event categories' };

export default async function CategoriesPage() {
  const catalog = await getCatalog(BRAND);
  return (
    <>
      <PageHeader eyebrow="Occasions" title="Event categories" lead="The kinds of gatherings we plan. Categories are configurable sample content." />
      <section className="section">
        <div className="container grid grid--3">
          {catalog.categories.map((c) => {
            const services = catalog.services.filter((s) => s.category?.id === c.id);
            return (
              <article key={c.id} id={c.slug} className="card stack" style={{ scrollMarginTop: 90 }}>
                <SampleImage imageKey={services[0]?.imageKey ?? 'events-detail'} ratio="4x3" className="arch" />
                <h2 style={{ fontSize: 'var(--step-2)' }}>{c.name}</h2>
                <p className="muted">{c.description}</p>
                <div style={{ marginTop: 'auto' }}>
                  {c.slug === 'planning'
                    ? <Link className="btn btn--sm" href="/book">Book a consultation</Link>
                    : <Link className="btn btn--sm" href={`/enquire?category=${c.slug}`}>Enquire</Link>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
