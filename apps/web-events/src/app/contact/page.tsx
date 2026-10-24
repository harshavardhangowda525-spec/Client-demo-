import type { Metadata } from 'next';
import { ContactPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Contact' };

export default function Page() {
  return <ContactPage brand={BRAND} title="Say hello" lead="General questions are welcome here. For event planning, the enquiry form gives the team everything they need." />;
}
