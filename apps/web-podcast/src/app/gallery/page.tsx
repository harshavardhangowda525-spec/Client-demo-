import type { Metadata } from 'next';
import { PageHeader, type PortfolioDetail, type PortfolioItem } from '@studio/ui';
import { SampleImage, serverApi } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Gallery' };

export default async function GalleryPage() {
  const items = (await serverApi<PortfolioItem[]>(`/api/v1/sites/${BRAND}/portfolio`)) ?? [];
  const details = await Promise.all(items.map((i) => serverApi<PortfolioDetail>(`/api/v1/sites/${BRAND}/portfolio/${i.slug}`)));
  const images = details.flatMap((d) => (d ? d.images.map((img) => ({ ...img, project: d.title })) : []));
  return (
    <>
      <PageHeader eyebrow="Gallery" title="Inside the studio" lead="AI-generated sample imagery showing how studio photography will be presented. Real photographs will replace these once supplied.">
        <span className="badge badge--demo">Sample imagery</span>
      </PageHeader>
      <section className="section">
        <div className="container gallery-grid">
          {images.map((img) => (
            <figure key={img.id}>
              <SampleImage imageKey={img.imageKey} alt={img.alt} ratio="auto" sizes="(min-width: 900px) 33vw, 100vw" />
              <figcaption className="figure-caption mono">{img.project}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
