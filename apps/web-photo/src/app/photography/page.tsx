import type { Metadata } from 'next';
import { PageHeader } from '@studio/ui';
import { getCatalog } from '@studio/ui/server';
import { ServiceSection } from '../../components/ServiceSection';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Photography' };

export default async function PhotographyPage() {
  const catalog = await getCatalog(BRAND);
  const services = catalog.services.filter((s) => s.category?.slug === 'photography');
  return (
    <>
      <PageHeader eyebrow="Photography" title="Photography services" lead="Portrait, product, commercial and event photography. Sample categories that the business can configure from the admin panel." />
      {services.map((s, i) => <ServiceSection key={s.id} service={s} index={i} />)}
    </>
  );
}
