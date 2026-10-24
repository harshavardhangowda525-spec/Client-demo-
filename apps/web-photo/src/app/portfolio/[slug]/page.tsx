import type { Metadata } from 'next';
import Link from 'next/link';
import type { PortfolioDetail } from '@studio/ui';
import { SampleImage, serverApi } from '@studio/ui/server';
import { BRAND } from '../../../site';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await serverApi<PortfolioDetail>(`/api/v1/sites/${BRAND}/portfolio/${encodeURIComponent(slug)}`, { allow404: true });
  return { title: p?.title ?? 'Project' };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const p = (await serverApi<PortfolioDetail>(`/api/v1/sites/${BRAND}/portfolio/${encodeURIComponent(slug)}`))!;
  const [first, ...rest] = p.images;
  return (
    <article>
      <header className="section" style={{ paddingBottom: 'var(--space-5)' }}>
        <div className="container">
          <Link href="/portfolio" className="small muted">← Portfolio</Link>
          <p className="eyebrow" style={{ marginTop: 'var(--space-5)' }}>{p.category?.name}</p>
          <h1>{p.title}</h1>
          <p className="lead">{p.summary}</p>
          {p.isSample && <span className="badge badge--demo">Sample project · AI-generated imagery · not client work</span>}
        </div>
      </header>
      <div className="container stack-lg">
        <figure style={{ margin: 0 }}>
          <SampleImage imageKey={first?.imageKey ?? p.coverImage} alt={first?.alt ?? p.coverAlt} ratio="16x9" priority sizes="100vw" />
          {first?.caption && <figcaption className="figure-caption">{first.caption}</figcaption>}
        </figure>
        <div className="split" style={{ alignItems: 'start' }}>
          <p className="rule-quote" style={{ fontSize: 'var(--step-2)' }}>{p.summary}</p>
          <div><p>{p.body}</p></div>
        </div>
        {rest.length > 0 && (
          <div className="grid grid--2">
            {rest.map((img) => (
              <figure key={img.id} style={{ margin: 0 }}>
                <SampleImage imageKey={img.imageKey} alt={img.alt} ratio="4x3" />
                {img.caption && <figcaption className="figure-caption">{img.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
        <div className="section center">
          <h2>Planning something similar?</h2>
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Link className="btn" href="/book">Book a session</Link>
            <Link className="btn btn--ghost" href="/contact">Talk to us</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
