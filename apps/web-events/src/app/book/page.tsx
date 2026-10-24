import type { Metadata } from 'next';
import Link from 'next/link';
import { BookPage, type SearchParams } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Book a consultation' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <BookPage
        brand={BRAND}
        searchParams={searchParams}
        title="Book a consultation"
        lead="Services with a fixed price and verified availability can be booked directly here. For a full event, send an enquiry and we will prepare a quotation."
        labels={{ location: 'Meeting location', notesPlaceholder: 'Occasion, rough date, guest count, ideas…' }}
      />
      <section className="section--tight section">
        <div className="container"><div className="alert alert--info"><p>Planning a complete event? <Link href="/enquire">Send an enquiry</Link>: it is reviewed by the team and is never booked automatically.</p></div></div>
      </section>
    </>
  );
}
