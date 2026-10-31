import type { Metadata } from 'next';
import Link from 'next/link';
import { getMe, getSiteConfig, serverApi, type SearchParams } from '@studio/ui/server';
import { Checkout } from '../../components/Checkout';
import type { PublicOffer } from '../../components/OfferCard';
import type { StudioService } from '../../lib/types';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Booking summary', robots: { index: false } };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const slug = one(sp.service);
  const location = one(sp.location);
  const date = one(sp.date);
  const time = one(sp.time);
  if (!slug || !location || !date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return (
      <section className="section"><div className="container stack" style={{ maxWidth: 640 }}>
        <h1>Choose a time first</h1>
        <p>Pick a service and a free time to see your booking summary.</p>
        <p><Link className="btn" href="/services">Browse services</Link></p>
      </div></section>
    );
  }
  const [service, site, me, offers] = await Promise.all([
    serverApi<StudioService>(`/api/v1/studio/services/${encodeURIComponent(slug)}`),
    getSiteConfig(BRAND),
    getMe(),
    serverApi<PublicOffer[]>('/api/v1/studio/offers'),
  ]);
  const loc = service!.locations.find((l) => l.id === location);
  if (!loc) {
    return <section className="section"><div className="container"><h1>That studio isn&rsquo;t available for this service</h1><p><Link href={`/service/${slug}/slots`}>Choose another time</Link></p></div></section>;
  }
  const relevant = (offers ?? []).filter((o) => !o.services.length || o.services.some((x) => x.slug === slug));
  return (
    <div className="container">
      <nav aria-label="Breadcrumb" className="small" style={{ marginTop: 'var(--space-4)' }}>
        <Link href={`/service/${slug}`}>{service!.name}</Link> › <Link href={`/service/${slug}/slots?date=${date}`}>Choose a time</Link> › <span aria-current="page">Booking summary</span>
      </nav>
      <Checkout
        service={service!}
        location={{ id: loc.id, name: loc.name, addressLine1: loc.addressLine1, city: loc.city, timezone: loc.timezone }}
        date={date}
        time={time}
        packageId={one(sp.package) ?? null}
        durationMin={one(sp.duration) && /^\d+$/.test(one(sp.duration)!) ? Number(one(sp.duration)) : null}
        site={site}
        me={me}
        offers={relevant}
      />
    </div>
  );
}
