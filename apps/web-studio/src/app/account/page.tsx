import type { Metadata } from 'next';
import Link from 'next/link';
import { formatCalendarDate } from '@studio/ui';
import { getMembership } from '../../lib/membership';
import { AccountPage, getMe, getSiteConfig, serverApi, type SearchParams } from '@studio/ui/server';
import { NotificationPreferences, SavedServices, type SavedItem } from '../../components/AccountExtras';
import { BRAND, HOME_BRANDS } from '../../site';

export const metadata: Metadata = { title: 'My account' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const me = await getMe();
  const [saved, prefs, site, membership] = me
    ? await Promise.all([
        serverApi<SavedItem[]>('/api/v1/me/saved', { auth: true }),
        serverApi<{ notifyEmail: boolean; notifyWhatsapp: boolean; whatsappConsentAt: string | null }>('/api/v1/me/preferences', { auth: true }),
        getSiteConfig(BRAND),
        getMembership(),
      ])
    : [null, null, null, null];
  return (
    <AccountPage brand={BRAND} searchParams={searchParams} homeBrands={HOME_BRANDS} allowGoogle>
      {me && !me.user.isStaff && (
        <section className={membership ? 'mb-account mb-account--member' : 'mb-account'} aria-labelledby="mb-account-h" style={{ marginTop: 'var(--space-6)' }}>
          <div>
            <p className="mb-eyebrow">Membership</p>
            <h2 id="mb-account-h" style={{ margin: 0 }}>{membership ? `${membership.plan.name} member` : 'Not a member yet'}</h2>
            <p style={{ margin: 'var(--space-2) 0 0' }}>
              {membership
                ? `${membership.bookingDiscountBps / 100}% off every booking · active until ${formatCalendarDate(membership.endsAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Members pay half price on every booking.'}
            </p>
          </div>
          <Link href="/membership" className={membership ? 'btn btn--ghost' : 'mb-btn'}>{membership ? 'Renew or change plan' : 'See plans'}</Link>
        </section>
      )}
      {me && (
        <div className="grid grid--2" style={{ marginTop: 'var(--space-6)', alignItems: 'start' }}>
          <SavedServices initial={saved ?? []} />
          {prefs && <NotificationPreferences initial={prefs} whatsappAvailable={!!site?.integrations.whatsappDelivery} />}
        </div>
      )}
    </AccountPage>
  );
}
