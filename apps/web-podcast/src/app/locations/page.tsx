import type { Metadata } from 'next';
import { LocationsPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Locations' };

export default function Page() {
  return <LocationsPage brand={BRAND} title="Studio locations" lead="Addresses, opening hours and bookable rooms. Locations and hours are demonstration data until the studio provides verified details." resourceLabel="Rooms & sets" />;
}
