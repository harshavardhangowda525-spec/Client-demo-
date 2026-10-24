import type { Metadata } from 'next';
import { ResetPasswordPage, type SearchParams } from '@studio/ui/server';

export const metadata: Metadata = { title: 'Reset password' };

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <ResetPasswordPage searchParams={searchParams} />;
}
