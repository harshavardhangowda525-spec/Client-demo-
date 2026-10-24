import type { Metadata } from 'next';
import { BookPage, type SearchParams } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Book a session' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <BookPage
      brand={BRAND}
      searchParams={searchParams}
      title="Book a recording session"
      lead="Choose your studio, session type, date, start time and duration. Availability and price are verified on our server before your slot is reserved."
      labels={{ location: 'Studio location', attendees: 'Number of hosts and guests (optional)', notesPlaceholder: 'Show format, number of microphones, camera angles, accessibility needs…' }}
      showAttendees
    />
  );
}
