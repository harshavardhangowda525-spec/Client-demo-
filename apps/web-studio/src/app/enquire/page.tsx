import type { Metadata } from 'next';
import { PageHeader } from '@studio/ui';
import { getCatalog, getLocations, getMe, type SearchParams } from '@studio/ui/server';
import { StudioEnquiryForm, type EnquiryServiceOption } from '../../components/StudioEnquiryForm';
import { todayIn } from '../../lib/today';
import { HOME_BRANDS } from '../../site';

export const metadata: Metadata = { title: 'Request a custom quote' };
const GROUP: Record<string, string> = { PHOTO: 'Photography & video', PODCAST: 'Podcast & studio production', EVENTS: 'Events' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const [sp, me, catalogs, locationLists] = await Promise.all([searchParams, getMe(), Promise.all(HOME_BRANDS.map(getCatalog)), Promise.all(HOME_BRANDS.map(getLocations))]);
  const services: EnquiryServiceOption[] = catalogs.flatMap((c, i) => c.services.map((s) => ({ id: s.id, slug: s.slug, name: s.name, brand: HOME_BRANDS[i]!, group: GROUP[HOME_BRANDS[i]!] ?? HOME_BRANDS[i]! })));
  const locations = [...new Map(locationLists.flat().map((l) => [l.id, { id: l.id, name: l.name, city: l.city }])).values()];
  const service = Array.isArray(sp.service) ? sp.service[0] : sp.service;
  return (
    <>
      <PageHeader eyebrow="Custom quotation" title="Tell us about your project" lead="For campaigns, multi-day shoots, series and anything that doesn't fit a standard package. The team replies with an itemised quotation you can accept online." />
      <section className="section section--tight">
        <div className="container container--narrow" style={{ marginInline: 'auto' }}>
          <StudioEnquiryForm services={services} locations={locations} me={me} initialService={service} today={todayIn()} />
        </div>
      </section>
    </>
  );
}
