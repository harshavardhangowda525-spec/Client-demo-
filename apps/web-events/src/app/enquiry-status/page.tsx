import type { Metadata } from 'next';
import { EnquiryStatusPage, type SearchParams } from '@studio/ui/server';

export const metadata: Metadata = { title: 'Enquiry status' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <EnquiryStatusPage searchParams={searchParams} />;
}
