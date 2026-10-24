import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, type PortfolioDetail, type PortfolioItem } from '@studio/ui';
import { SampleImage, serverApi } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Gallery' };

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const all = (await serverApi<PortfolioItem[]>(`/api/v1/sites/${BRAND}/portfolio`)) ?? [];
  const cats = [...new Map(all.filter((p) => p.category).map((p) => [p.category!.slug, p.category!])).values()];
  const items = category ? all.filter((p) => p.category?.slug === category) : all;
  const details = await Promise.all(items.map((i) => serverApi<PortfolioDetail>(`/api/v1/sites/${BRAND}/portfolio/${i.slug}`)));
  return (
    <>
      <PageHeader eyebrow="Gallery" title="Event gallery" lead="Sample imagery generated for the demonstration. These are not events delivered by the business.">
        <span className="badge badge--demo">AI-generated sample imagery</span>
      </PageHeader>
      <section className="section">
        <div className="container">
          <nav className="filters" aria-label="Filter by occasion">
            <Link className="chip" href="/gallery" aria-current={!category ? 'true' : undefined}>All</Link>
            {cats.map((c) => <Link key={c.slug} className="chip" href={`/gallery?category=${c.slug}`} aria-current={category === c.slug ? 'true' : undefined}>{c.name}</Link>)}
          </nav>
          <div className="stack-lg">
            {details.map((d) => d && (
              <article key={d.id} className="stack">
                <h2 style={{ fontSize: 'var(--step-2)' }}>{d.title}</h2>
                <p className="muted">{d.summary}</p>
                <div className="grid grid--2">
                  {d.images.map((img) => (
                    <figure key={img.id} style={{ margin: 0 }}>
                      <SampleImage imageKey={img.imageKey} alt={img.alt} ratio="4x3" />
                    </figure>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
