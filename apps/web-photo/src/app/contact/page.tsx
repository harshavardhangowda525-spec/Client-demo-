import type { Metadata } from 'next';
import { ContactPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return <ContactPage brand={BRAND} title="Tell us about your project" lead="Messages are saved to the studio's admin panel. We'll reply by email." />;
}
