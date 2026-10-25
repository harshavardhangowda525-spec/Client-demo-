import type { Metadata } from 'next';
import Link from 'next/link';
import { BookingFlow, PageHeader } from '@studio/ui';
import { getCatalog, getLocations, getMe, getSiteConfig, type SearchParams } from '@studio/ui/server';
import { BRAND, HOME_BRANDS } from '../../site';

export const metadata: Metadata = { title: 'Book' };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const [sp, site, me, ...rest] = await Promise.all([searchParams, getSiteConfig(BRAND), getMe(), ...HOME_BRANDS.map(getCatalog), ...HOME_BRANDS.map(getLocations)]);
  const catalogs = rest.slice(0, HOME_BRANDS.length) as Awaited<ReturnType<typeof getCatalog>>[];
  const locationLists = rest.slice(HOME_BRANDS.length) as Awaited<ReturnType<typeof getLocations>>[];
  const services = catalogs.flatMap((c) => c.services).filter((s) => s.bookingMode !== 'ENQUIRY');
  const locations = [...new Map(locationLists.flat().map((l) => [l.id, l])).values()];
  const step = Number(one(sp.step));
  return (
    <>
      <PageHeader eyebrow="Booking" title="Complete your booking" lead="Check your selection, add your details and reserve. Prices and availability are re-checked on our server before anything is confirmed.">
        <p className="small" style={{ margin: 0 }}>Need something custom? <Link href="/enquire">Request a quotation</Link>.</p>
      </PageHeader>
      <section className="section section--tight">
        <div className="container">
          <BookingFlow
            brand={BRAND}
            sourceSite="STUDIO"
            site={site}
            services={services}
            locations={locations}
            me={me}
            showAttendees
            labels={{ location: 'Studio location', notesPlaceholder: 'Brief, references, number of people, anything we should prepare…' }}
            initial={{
              service: one(sp.service),
              package: one(sp.package),
              location: one(sp.location),
              date: one(sp.date),
              time: one(sp.time),
              duration: one(sp.duration),
              addOns: one(sp.addons)?.split(',').filter(Boolean).slice(0, 20),
              step: Number.isFinite(step) ? step : undefined,
            }}
          />
        </div>
      </section>
    </>
  );
}
