import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, type Catalog, type PortfolioItem } from '@studio/ui';
import { getCatalog, SampleImage, serverApi } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Portfolio' };

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [catalog, items]: [Catalog, PortfolioItem[] | null] = await Promise.all([
    getCatalog(BRAND),
    serverApi<PortfolioItem[]>(`/api/v1/sites/${BRAND}/portfolio${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  ]);
  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Selected work" lead="A sample portfolio created with AI-generated imagery to show how real projects will be presented. It does not represent actual client work.">
        <span className="badge badge--demo">Sample content</span>
      </PageHeader>
      <section className="section">
        <div className="container">
          <nav aria-label="Filter by category" className="filters">
            <Link className="chip" href="/portfolio" aria-current={!category ? 'true' : undefined}>All</Link>
            {catalog.categories.map((c) => (
              <Link key={c.id} className="chip" href={`/portfolio?category=${c.slug}`} aria-current={category === c.slug ? 'true' : undefined}>{c.name}</Link>
            ))}
          </nav>
          {items && items.length ? (
            <div className="grid grid--3">
              {items.map((p) => (
                <Link key={p.id} href={`/portfolio/${p.slug}`} className="card--link" style={{ textDecoration: 'none' }}>
                  <SampleImage imageKey={p.coverImage} alt={p.coverAlt} ratio="4x3" hover sizes="(min-width: 900px) 33vw, 100vw" />
                  <p className="eyebrow" style={{ marginTop: 'var(--space-4)' }}>{p.category?.name}</p>
                  <h2 style={{ fontSize: 'var(--step-2)', marginBottom: 'var(--space-2)' }}>{p.title}</h2>
                  <p className="muted small">{p.summary}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No projects in this category yet.</div>
          )}
        </div>
      </section>
    </>
  );
}
