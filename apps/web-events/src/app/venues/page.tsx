import type { Metadata } from 'next';
import { LocationsPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Locations & venues' };

export default function Page() {
  return <LocationsPage brand={BRAND} title="Locations & venues" lead="Our planning lounge and partner venues. Venue names, capacities and hours are demonstration data until confirmed." resourceLabel="Spaces" />;
}
