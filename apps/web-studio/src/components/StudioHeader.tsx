import Link from 'next/link';
import { getMe, serverApi } from '@studio/ui/server';
import { getCity, hasChosenCity } from '../lib/city';
import { getMembership } from '../lib/membership';
import type { StudioCategory } from '../lib/types';
import { CategoryBar } from './CategoryBar';
import { CityPicker } from './CityPicker';
import { SearchBox } from './SearchBox';

export async function StudioHeader({ siteName }: { siteName: string }) {
  const [me, cities, categories, city, chosen, membership] = await Promise.all([
    getMe(),
    serverApi<{ cities: string[] }>('/api/v1/studio/cities'),
    serverApi<StudioCategory[]>('/api/v1/studio/categories'),
    getCity(),
    hasChosenCity(),
    getMembership(),
  ]);
  const firstName = me?.profile.fullName.split(' ')[0];
  return (
    <header className="st-header">
      <div className="container">
        <div className="st-header__row">
          <Link href="/" className="st-logo">
            <span className="st-logo__mark" aria-hidden="true">∞</span>
            <span>{siteName.replace(/\s*\(demo\)\s*$/i, '')}{membership && <b className="mb-logo-tag"> Premium</b>} <small>demo</small></span>
          </Link>
          <SearchBox className="st-search--desktop" />
          <div className="st-header__actions">
            <CityPicker cities={cities?.cities ?? []} current={city} askOnLoad={!chosen && !city} />
            {membership ? (
              <Link href="/membership" className="mb-badge" title={`${membership.plan.name} member`}><span aria-hidden="true">♛</span> <span className="mb-badge__plan">{membership.plan.name}</span></Link>
            ) : !me?.user.isStaff ? (
              <Link href="/membership" className="mb-cta st-hide-sm">Go Premium</Link>
            ) : null}
            {firstName ? (
              <Link href="/account" className="st-city" style={{ textDecoration: 'none' }}>Hi, {firstName}</Link>
            ) : (
              <Link href="/account" className="st-signin">Sign in</Link>
            )}
          </div>
        </div>
        <SearchBox className="st-search--mobile" />
      </div>
      <CategoryBar categories={categories ?? []} />
    </header>
  );
}
