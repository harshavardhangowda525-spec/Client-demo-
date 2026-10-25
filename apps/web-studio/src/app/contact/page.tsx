import type { Metadata } from 'next';
import { ContactPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return <ContactPage brand={BRAND} title="Contact the studio" lead="Questions about a booking or the studio? Messages go to the team's admin panel and we reply by email. For a project quotation, use the quote request form instead." />;
}
