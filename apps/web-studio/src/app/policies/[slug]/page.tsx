import type { Metadata } from 'next';
import { PageHeader } from '@studio/ui';
import { serverApi } from '@studio/ui/server';

type Params = Promise<{ slug: string }>;
type ContentPage = { slug: string; title: string; body: string; isTemplate: boolean; updatedAt: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await serverApi<ContentPage>(`/api/v1/studio/pages/${encodeURIComponent(slug)}`, { allow404: true });
  return { title: p?.title ?? 'Policy' };
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  const p = (await serverApi<ContentPage>(`/api/v1/studio/pages/${encodeURIComponent(slug)}`))!;
  return (
    <>
      <PageHeader eyebrow="Policies" title={p.title} />
      <section className="section">
        <div className="container container--narrow" style={{ marginInline: 'auto' }}>
          {p.isTemplate && <p className="alert alert--warning">Template text awaiting review by the business. It is not a final legal policy.</p>}
          {p.body.split(/\n{2,}/).map((para, i) => <p key={i} style={{ whiteSpace: 'pre-line' }}>{para}</p>)}
          <p className="small muted">Last updated {new Date(p.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
        </div>
      </section>
    </>
  );
}
