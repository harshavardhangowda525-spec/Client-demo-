import type { Metadata } from 'next';
import { BookPage, type SearchParams } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Book a session' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <BookPage
      brand={BRAND}
      searchParams={searchParams}
      title="Book a session"
      lead="Choose a service, see live availability and an itemised price, then reserve your slot. Larger productions are submitted as requests for the team to review."
      labels={{ location: 'Studio / base location', notesPlaceholder: 'Shot list, references, styling notes…' }}
      showAttendees
    />
  );
}
