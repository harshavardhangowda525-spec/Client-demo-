import type { Metadata } from 'next';
import { AccountPage, getMe, getSiteConfig, serverApi, type SearchParams } from '@studio/ui/server';
import { NotificationPreferences, SavedServices, type SavedItem } from '../../components/AccountExtras';
import { BRAND, HOME_BRANDS } from '../../site';

export const metadata: Metadata = { title: 'My account' };

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const me = await getMe();
  const [saved, prefs, site] = me
    ? await Promise.all([
        serverApi<SavedItem[]>('/api/v1/me/saved', { auth: true }),
        serverApi<{ notifyEmail: boolean; notifyWhatsapp: boolean; whatsappConsentAt: string | null }>('/api/v1/me/preferences', { auth: true }),
        getSiteConfig(BRAND),
      ])
    : [null, null, null];
  return (
    <AccountPage brand={BRAND} searchParams={searchParams} homeBrands={HOME_BRANDS} allowGoogle>
      {me && (
        <div className="grid grid--2" style={{ marginTop: 'var(--space-6)', alignItems: 'start' }}>
          <SavedServices initial={saved ?? []} />
          {prefs && <NotificationPreferences initial={prefs} whatsappAvailable={!!site?.integrations.whatsappDelivery} />}
        </div>
      )}
    </AccountPage>
  );
}
