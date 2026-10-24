import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@studio/ui';
import { resolveImage, SampleImage, serverApi, type SearchParams } from '@studio/ui/server';
import { Gallery } from '../../components/Lightbox';
import type { StudioPortfolio } from '../../lib/types';

export const metadata: Metadata = { title: 'Portfolio' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const data = (await serverApi<StudioPortfolio>(`/api/v1/studio/portfolio${category ? `?category=${encodeURIComponent(category)}` : ''}`))!;
  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Selected work" lead="Photography, film and podcast productions. Filter by discipline.">
        {data.items.some((i) => i.isSample) && <p className="badge badge--demo" style={{ margin: 0 }}>Sample projects with AI-generated imagery</p>}
      </PageHeader>
      <section className="section section--tight">
        <div className="container">
          <nav aria-label="Portfolio categories" className="st-chips" style={{ marginBottom: 'var(--space-6)' }}>
            <Link className="chip" href="/portfolio" aria-current={!category ? 'true' : undefined}>All</Link>
            {data.categories.map((c) => <Link key={c.slug} className="chip" href={`/portfolio?category=${c.slug}`} aria-current={category === c.slug ? 'true' : undefined}>{c.name}</Link>)}
          </nav>
          {data.items.length === 0 && <div className="empty">No published projects in this category yet.</div>}
          <div className="stack-lg">
            {data.items.map((p) => {
              const images = [{ imageKey: p.coverImage, alt: p.coverAlt, caption: null as string | null, id: `${p.id}-cover` }, ...p.images];
              return (
                <article key={p.id} id={p.slug} className="st-panel stack" aria-labelledby={`${p.slug}-title`} style={{ scrollMarginTop: 140 }}>
                  <div className="cluster" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <p className="small muted" style={{ margin: 0 }}>{p.category?.name}{p.clientCredit ? ` · ${p.clientCredit}` : ''}</p>
                      <h2 id={`${p.slug}-title`} style={{ margin: 0, fontSize: 'var(--step-2)' }}>{p.title}</h2>
                    </div>
                    {p.isSample && <span className="badge badge--demo">Sample project</span>}
                  </div>
                  <p style={{ margin: 0 }}>{p.summary}</p>
                  {p.videoUrl && (p.videoUrl.startsWith('/') ? (
                    <video controls preload="none" playsInline style={{ width: '100%', borderRadius: 'var(--radius-media)', background: '#000' }} poster={resolveImage(p.coverImage).src ?? undefined} aria-label={`${p.title} video`}>
                      <source src={p.videoUrl} />
                      Your browser can&rsquo;t play this video. <a href={p.videoUrl}>Download it</a>.
                    </video>
                  ) : (
                    <p style={{ margin: 0 }}><a className="btn btn--sm" href={p.videoUrl} target="_blank" rel="noopener noreferrer">Watch the film<span className="visually-hidden"> (opens in a new tab)</span></a></p>
                  ))}
                  <Gallery
                    items={images.map((img) => ({ key: img.id, src: resolveImage(img.imageKey).src, alt: img.alt, caption: img.caption, thumb: <SampleImage imageKey={img.imageKey} alt={img.alt} ratio="4x3" sizes="(min-width: 760px) 25vw, 50vw" /> }))}
                  />
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
