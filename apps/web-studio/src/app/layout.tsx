import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/roboto';
import '@studio/ui/styles.css';
import './theme.css';
import './premium.css';
import { DemoBar } from '@studio/ui';
import { adminUrl, getMe, getSiteConfig, serverApi } from '@studio/ui/server';
import { SessionProvider } from '../components/Session';
import { StudioFooter } from '../components/StudioFooter';
import { StudioHeader } from '../components/StudioHeader';
import { getMembership } from '../lib/membership';
import type { StudioCategory } from '../lib/types';
import { BRAND } from '../site';

// Every page shows live data (availability, prices, bookings), so nothing is prerendered at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const site = (await getSiteConfig(BRAND)).site;
  return {
    title: { default: `${site.name} · Book creative studio services`, template: `%s · ${site.name}` },
    description: site.tagline,
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: '#ffffff' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [config, categories, me, membership] = await Promise.all([getSiteConfig(BRAND), serverApi<StudioCategory[]>('/api/v1/studio/categories'), getMe(), getMembership()]);
  return (
    <html lang="en-IN">
      {/* Members see the premium (dark and gold) version of the whole site. */}
      <body className={membership ? 'st-premium' : undefined} data-plan={membership?.plan.key}>
        <SessionProvider signedIn={!!me} signIn={{ emailDelivery: config.integrations.emailDelivery, googleSignIn: !!config.integrations.googleSignIn, adminUrl: adminUrl() }}>
        <a href="#main" className="skip-link">Skip to content</a>
        <DemoBar />
        <StudioHeader siteName={config.site.name} />
        <main id="main">{children}</main>
        <StudioFooter site={config.site} categories={categories ?? []} />
        </SessionProvider>
      </body>
    </html>
  );
}
