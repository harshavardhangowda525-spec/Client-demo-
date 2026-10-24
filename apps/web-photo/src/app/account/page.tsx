import type { Metadata } from 'next';
import { AccountPage, type SearchParams } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'My account' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <AccountPage brand={BRAND} searchParams={searchParams} />;
}
