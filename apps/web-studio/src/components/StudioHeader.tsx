import Link from 'next/link';
import { getMe, serverApi } from '@studio/ui/server';
import { getCity } from '../lib/city';
import type { StudioCategory } from '../lib/types';
import { CategoryBar } from './CategoryBar';
import { CityPicker } from './CityPicker';
import { SearchBox } from './SearchBox';

export async function StudioHeader({ siteName }: { siteName: string }) {
  const [me, cities, categories, city] = await Promise.all([
    getMe(),
    serverApi<{ cities: string[] }>('/api/v1/studio/cities'),
    serverApi<StudioCategory[]>('/api/v1/studio/categories'),
    getCity(),
  ]);
  const firstName = me?.profile.fullName.split(' ')[0];
  return (
    <header className="st-header">
      <div className="container">
        <div className="st-header__row">
          <Link href="/" className="st-logo">
            <span className="st-logo__mark" aria-hidden="true">∞</span>
            <span>{siteName.replace(/\s*\(demo\)\s*$/i, '')} <small>demo</small></span>
          </Link>
          <SearchBox className="st-search--desktop" />
          <div className="st-header__actions">
            <CityPicker cities={cities?.cities ?? []} current={city} />
            <Link href="/account" className="btn btn--ghost btn--sm st-hide-sm">{firstName ? `Hi, ${firstName}` : 'Sign in'}</Link>
            <Link href="/services" className="btn btn--sm">Book now</Link>
          </div>
        </div>
        <SearchBox className="st-search--mobile" />
      </div>
      <CategoryBar categories={categories ?? []} />
    </header>
  );
}
