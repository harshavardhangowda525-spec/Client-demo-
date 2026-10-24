import type { Metadata } from 'next';
import { EnquiryForm, PageHeader } from '@studio/ui';
import { getCatalog, getLocations, getMe } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Event enquiry' };

export default async function EnquirePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [{ category }, catalog, locations, me] = await Promise.all([searchParams, getCatalog(BRAND), getLocations(BRAND), getMe()]);
  return (
    <>
      <PageHeader eyebrow="Enquiry" title="Tell us about your event" lead="Share the essentials and we will prepare a tailored proposal. Submitting an enquiry does not book your date." />
      <section className="section">
        <div className="container container--narrow" style={{ marginInline: 'auto' }}>
          <EnquiryForm
            categories={catalog.categories.filter((c) => c.slug !== 'planning')}
            services={catalog.services.filter((s) => s.bookingMode === 'ENQUIRY')}
            locations={locations}
            me={me}
            initialCategory={category}
          />
        </div>
      </section>
    </>
  );
}
