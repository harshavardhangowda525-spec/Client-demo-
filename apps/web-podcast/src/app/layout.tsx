import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@studio/ui/styles.css';
import './theme.css';
import { DemoBar, SiteFooter, SiteHeader } from '@studio/ui';
import { shell } from '../site';

export const metadata: Metadata = {
  title: { default: 'Signal Room · Podcast studios (demo)', template: '%s · Signal Room (demo)' },
  description: 'Demonstration website for a podcast studio: studio discovery, live availability and session booking. Sample content.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0a1226', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <DemoBar />
        <SiteHeader
          brandMark={<><svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="10" fill="none" stroke="var(--accent)" strokeWidth="1.5" /><circle cx="11" cy="11" r="3.5" fill="var(--accent)" /></svg><span style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>Signal Room</span></>}
          nav={shell.nav}
          cta={shell.cta}
        />
        <main id="main">{children}</main>
        <SiteFooter shell={shell} email="podcast@example.com" tagline="Studios built for clear conversations. A demonstration website by Infinity Web & Apps." />
      </body>
    </html>
  );
}
