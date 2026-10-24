import type { Metadata } from 'next';
import { ContactPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return <ContactPage brand={BRAND} title="Talk to the studio" lead="Questions about formats, tours or series bookings. Messages go straight to the studio's admin panel." />;
}
