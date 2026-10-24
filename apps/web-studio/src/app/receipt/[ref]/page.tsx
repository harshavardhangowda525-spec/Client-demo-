import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteConfig, type SearchParams } from '@studio/ui/server';
import { Receipt } from '../../../components/Receipt';
import { BRAND } from '../../../site';

export const metadata: Metadata = { title: 'Receipt', robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: SearchParams }) {
  const [{ ref }, sp, site] = await Promise.all([params, searchParams, getSiteConfig(BRAND)]);
  if (!/^[A-Z]{2}-[0-9A-Z]{8}$/i.test(ref)) notFound();
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  return (
    <section className="section section--tight">
      <div className="container">
        <Receipt reference={ref.toUpperCase()} token={token} businessName={site.site.name} />
      </div>
    </section>
  );
}
