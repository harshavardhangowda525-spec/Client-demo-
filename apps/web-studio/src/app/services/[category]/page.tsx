import type { Metadata } from 'next';
import { serverApi, type SearchParams } from '@studio/ui/server';
import { Listing } from '../../../components/Listing';
import type { StudioCategory } from '../../../lib/types';

type Params = Promise<{ category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params;
  const cats = (await serverApi<StudioCategory[]>('/api/v1/studio/categories')) ?? [];
  return { title: cats.find((c) => c.slug === category)?.name ?? 'Services' };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { category } = await params;
  return <Listing category={category} searchParams={searchParams} />;
}
