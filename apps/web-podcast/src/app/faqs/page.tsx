import type { Metadata } from 'next';
import { FaqPage } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'FAQs' };

export default function Page() {
  return <FaqPage brand={BRAND} lead="Studio booking, rooms and payment questions." />;
}
