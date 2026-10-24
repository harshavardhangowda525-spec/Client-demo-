import type { Metadata } from 'next';
import type { SearchParams } from '@studio/ui/server';
import { Listing } from '../../components/Listing';

export const metadata: Metadata = { title: 'All services' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <Listing searchParams={searchParams} lead="Photography, video and podcast studio services. Filter by city, price, length or the date you need." />;
}
