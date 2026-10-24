import type { Metadata } from 'next';
import { PageHeader } from '@studio/ui';
import { getCatalog } from '@studio/ui/server';
import { ServiceSection } from '../../components/ServiceSection';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Videography' };

export default async function VideographyPage() {
  const catalog = await getCatalog(BRAND);
  const services = catalog.services.filter((s) => s.category?.slug === 'videography');
  return (
    <>
      <PageHeader eyebrow="Videography" title="Videography services" lead="Promotional films and corporate video production. Sample categories that the business can configure from the admin panel." />
      {services.map((s, i) => <ServiceSection key={s.id} service={s} index={i} />)}
    </>
  );
}
