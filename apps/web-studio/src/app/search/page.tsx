import type { Metadata } from 'next';
import Link from 'next/link';
import { serverApi, type SearchParams } from '@studio/ui/server';
import { ServiceCard } from '../../components/ServiceCard';
import { todayIn } from '../../lib/today';
import type { StudioSearch } from '../../lib/types';

export const metadata: Metadata = { title: 'Search' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? '';
  const res = q.length >= 2 ? await serverApi<StudioSearch>(`/api/v1/studio/search?q=${encodeURIComponent(q)}`) : null;
  const today = todayIn();
  return (
    <div className="container" style={{ paddingBlock: 'var(--space-6)' }}>
      <h1 style={{ marginBottom: 'var(--space-2)' }}>{q ? <>Results for &ldquo;{q}&rdquo;</> : 'Search'}</h1>
      <form action="/search" method="get" role="search" className="cluster" style={{ marginBottom: 'var(--space-5)', maxWidth: 560 }}>
        <label htmlFor="sq" className="visually-hidden">Search services</label>
        <input className="input" id="sq" name="q" type="search" defaultValue={q} placeholder="Search services, packages, equipment" style={{ flex: 1 }} />
        <button className="btn" type="submit">Search</button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="muted">Type at least two characters.</p>}
      {res && res.categories.length > 0 && (
        <div className="st-chips" style={{ marginBottom: 'var(--space-5)' }}>
          <span className="small muted" style={{ alignSelf: 'center' }}>Categories:</span>
          {res.categories.map((c) => <Link key={c.slug} className="chip" href={`/services/${c.slug}`}>{c.name}</Link>)}
        </div>
      )}
      {res && (res.services.length ? (
        <div className="st-grid">{res.services.map((s) => <ServiceCard key={s.id} s={s} today={today} />)}</div>
      ) : (
        <div className="empty stack" style={{ alignItems: 'center' }}>
          <p style={{ margin: 0 }}>No services match &ldquo;{q}&rdquo;.</p>
          <Link className="btn btn--sm" href="/services">Browse all services</Link>
        </div>
      ))}
    </div>
  );
}
