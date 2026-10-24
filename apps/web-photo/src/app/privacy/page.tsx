import type { Metadata } from 'next';
import { LegalPage } from '@studio/ui/server';

export const metadata: Metadata = { title: 'Privacy notice' };

export default function Page() {
  return <LegalPage kind="privacy" siteName="Lumen Studio" />;
}
