import Link from 'next/link';
import { formatDuration } from '@studio/ui';
import { SampleImage, serverApi, type SearchParams } from '@studio/ui/server';
import { getCity } from '../lib/city';
import { todayIn } from '../lib/today';
import type { StudioListing } from '../lib/types';
import { AutoSubmitForm } from './AutoSubmitForm';
import { FiltersDisclosure } from './FiltersDisclosure';
import { ServiceCard } from './ServiceCard';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const TYPE_LABELS: Record<string, string> = { package: 'Packages', hourly: 'Hourly', fixed: 'Fixed price', quote: 'Custom quote' };
const SORTS = [
  ['popular', 'Popularity'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['duration', 'Shortest duration'],
  ['name', 'Name (A–Z)'],
] as const;

export async function Listing({ category, searchParams, title, lead }: { category?: string; searchParams: SearchParams; title?: string; lead?: string }) {
  const sp = await searchParams;
  const cookieCity = await getCity();
  const city = one(sp.city) ?? cookieCity ?? '';
  const rupees = (v: string | undefined) => (v && /^\d{1,7}$/.test(v) ? String(Number(v) * 100) : undefined);
  const params: Record<string, string | undefined> = {
    category,
    q: one(sp.q)?.slice(0, 100),
    city: city || undefined,
    minPrice: rupees(one(sp.min)),
    maxPrice: rupees(one(sp.max)),
    maxDuration: one(sp.duration),
    equipment: one(sp.equipment),
    type: one(sp.type),
    date: one(sp.date),
    sort: one(sp.sort),
    page: one(sp.page),
  };
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  const data = await serverApi<StudioListing>(`/api/v1/studio/services?${qs}`);
  if (!data) throw new Error('Listing unavailable');
  const today = todayIn();
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const base = category ? `/services/${category}` : '/services';
  const pageHref = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== 'page' && one(v)) u.set(k, one(v)!);
    if (p > 1) u.set('page', String(p));
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  const active = ['q', 'min', 'max', 'duration', 'equipment', 'type', 'date'].filter((k) => one(sp[k]));
  const heading = title ?? data.category?.name ?? 'All services';

  return (
    <div className="container">
      {data.category ? (
        <header className="st-catbanner">
          <SampleImage imageKey={data.category.imageKey} alt="" ratio="auto" sizes="100vw" priority />
          <div>
            <h1>{heading}</h1>
            {data.category.description && <p>{data.category.description}</p>}
          </div>
        </header>
      ) : (
        <header style={{ marginTop: 'var(--space-6)' }}>
          <h1 style={{ marginBottom: 'var(--space-2)' }}>{heading}</h1>
          {lead && <p className="lead" style={{ margin: 0 }}>{lead}</p>}
        </header>
      )}

      <div className="st-listing">
        <FiltersDisclosure activeCount={active.length}>
          <summary>Filters{active.length ? ` (${active.length})` : ''} <span className="st-toggle small muted">Show / hide</span></summary>
          <AutoSubmitForm id="filters" action={base} className="stack" style={{ marginTop: 'var(--space-4)' }}>
            <div className="field">
              <label htmlFor="f-q">Keyword</label>
              <input className="input" id="f-q" name="q" type="search" defaultValue={one(sp.q) ?? ''} placeholder="e.g. portrait, interview" />
            </div>
            <div className="field">
              <label htmlFor="f-city">City</label>
              <select className="select" id="f-city" name="city" defaultValue={city}>
                <option value="">All cities</option>
                {data.facets.cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-date">Available on</label>
              <input className="input" id="f-date" name="date" type="date" min={today} defaultValue={one(sp.date) ?? ''} />
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 'var(--space-2)' }}>Price (₹, starting price)</legend>
              <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                <label className="visually-hidden" htmlFor="f-min">Minimum price in rupees</label>
                <input className="input" id="f-min" name="min" type="number" min={0} step={500} inputMode="numeric" placeholder={`${Math.floor(data.facets.priceMin / 100)}`} defaultValue={one(sp.min) ?? ''} />
                <span aria-hidden="true">–</span>
                <label className="visually-hidden" htmlFor="f-max">Maximum price in rupees</label>
                <input className="input" id="f-max" name="max" type="number" min={0} step={500} inputMode="numeric" placeholder={`${Math.ceil(data.facets.priceMax / 100)}`} defaultValue={one(sp.max) ?? ''} />
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="f-type">Booking type</label>
              <select className="select" id="f-type" name="type" defaultValue={one(sp.type) ?? ''}>
                <option value="">Any</option>
                {data.facets.types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-duration">Session length</label>
              <select className="select" id="f-duration" name="duration" defaultValue={one(sp.duration) ?? ''}>
                <option value="">Any</option>
                {data.facets.durations.map((d) => <option key={d} value={d}>Up to {formatDuration(d)}</option>)}
              </select>
            </div>
            {data.facets.equipment.length > 0 && (
              <div className="field">
                <label htmlFor="f-eq">Equipment</label>
                <select className="select" id="f-eq" name="equipment" defaultValue={one(sp.equipment) ?? ''}>
                  <option value="">Any</option>
                  {data.facets.equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
            <input type="hidden" name="sort" value={one(sp.sort) ?? 'popular'} />
            <div className="cluster">
              <button className="btn btn--sm" type="submit">Apply</button>
              {active.length > 0 && <Link className="btn btn--ghost btn--sm" href={base}>Clear filters</Link>}
            </div>
          </AutoSubmitForm>
        </FiltersDisclosure>

        <div>
          <div className="st-toolbar">
            <p style={{ margin: 0 }} aria-live="polite"><strong>{data.total}</strong> {data.total === 1 ? 'service' : 'services'}{city ? ` in ${city}` : ''}</p>
            <AutoSubmitForm action={base} className="cluster" style={{ gap: 'var(--space-2)' }}>
              {Object.entries(sp).filter(([k]) => k !== 'sort' && k !== 'page').map(([k, v]) => one(v) ? <input key={k} type="hidden" name={k} value={one(v)} /> : null)}
              <label htmlFor="f-sort" className="small muted">Sort by</label>
              <select className="select" id="f-sort" name="sort" defaultValue={one(sp.sort) ?? 'popular'} style={{ width: 'auto', minHeight: 40 }}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <noscript><button className="btn btn--sm" type="submit">Sort</button></noscript>
            </AutoSubmitForm>
          </div>
          {data.items.length ? (
            <div className="st-grid">
              {data.items.map((s, i) => <ServiceCard key={s.id} s={s} today={today} priority={i < 4} />)}
            </div>
          ) : (
            <div className="empty stack" style={{ alignItems: 'center' }}>
              <p style={{ margin: 0 }}>No services match these filters.</p>
              <Link className="btn btn--sm" href={base}>Clear filters</Link>
            </div>
          )}
          {pages > 1 && (
            <nav className="st-pager" aria-label="Pagination">
              {data.page > 1 ? <Link className="btn btn--ghost btn--sm" href={pageHref(data.page - 1)} rel="prev">‹ Previous</Link> : <span />}
              <span className="small">Page {data.page} of {pages}</span>
              {data.page < pages ? <Link className="btn btn--ghost btn--sm" href={pageHref(data.page + 1)} rel="next">Next ›</Link> : <span />}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
