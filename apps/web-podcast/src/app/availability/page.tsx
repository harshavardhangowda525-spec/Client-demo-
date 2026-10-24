import type { Metadata } from 'next';
import { AvailabilityExplorer, PageHeader } from '@studio/ui';
import { getCatalog, getLocations, getSiteConfig } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Availability calendar' };

export default async function AvailabilityPage() {
  const [catalog, locations, site] = await Promise.all([getCatalog(BRAND), getLocations(BRAND), getSiteConfig(BRAND)]);
  return (
    <>
      <PageHeader eyebrow="Availability" title="Availability calendar" lead="Live availability from the booking engine, including turnaround time and maintenance blocks. Pick a time to start a booking." />
      <section className="section">
        <div className="container">
          <AvailabilityExplorer services={catalog.services.filter((s) => s.bookingMode !== 'ENQUIRY')} locations={locations} timezone={site.regional.timezone} />
        </div>
      </section>
    </>
  );
}
