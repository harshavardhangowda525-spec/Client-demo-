import type { Metadata } from 'next';
import { LegalPage } from '@studio/ui/server';

export const metadata: Metadata = { title: 'Terms of booking' };

export default function Page() {
  return <LegalPage kind="terms" siteName="Lumen Studio" />;
}
