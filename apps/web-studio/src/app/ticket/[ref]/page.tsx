import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { SearchParams } from '@studio/ui/server';
import { Ticket } from '../../../components/Ticket';

export const metadata: Metadata = { title: 'E-ticket', robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: SearchParams }) {
  const [{ ref }, sp] = await Promise.all([params, searchParams]);
  if (!/^[A-Z]{2}-[0-9A-Z]{8}$/i.test(ref)) notFound();
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  return (
    <section className="section section--tight">
      <div className="container">
        <Ticket reference={ref.toUpperCase()} token={token} />
      </div>
    </section>
  );
}
