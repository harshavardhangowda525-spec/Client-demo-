import type { Metadata } from 'next';
import { BookingStatusPage, type SearchParams } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Booking status' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <BookingStatusPage brand={BRAND} searchParams={searchParams} />;
}
