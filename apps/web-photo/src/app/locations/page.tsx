import type { Metadata } from 'next';
import { LocationsPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Studio & locations' };

export default function Page() {
  return <LocationsPage brand={BRAND} title="The studio" lead="Where we shoot. Locations and opening hours are demonstration data until the real details are provided." resourceLabel="Studios & crews" />;
}
