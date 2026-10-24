import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/cormorant-garamond';
import '@fontsource-variable/inter';
import '@studio/ui/styles.css';
import './theme.css';
import { DemoBar, SiteFooter, SiteHeader } from '@studio/ui';
import { shell } from '../site';

// Every page shows live data (availability, prices, bookings), so nothing is prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Lumen Studio · Photography & Film (demo)', template: '%s · Lumen Studio (demo)' },
  description: 'Demonstration website for a photography and videography studio. Sample services, prices and AI-generated imagery.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#141317' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <DemoBar />
        <SiteHeader brandMark={<><span style={{ fontStyle: 'italic' }}>Lumen</span> Studio</>} nav={shell.nav} cta={shell.cta} />
        <main id="main">{children}</main>
        <SiteFooter shell={shell} email="photo@example.com" tagline="Photography and film, composed with intent. A demonstration website by Infinity Web & Apps." />
      </body>
    </html>
  );
}
