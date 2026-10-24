import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/jost';
import '@studio/ui/styles.css';
import './theme.css';
import { DemoBar, SiteFooter, SiteHeader } from '@studio/ui';
import { shell } from '../site';

// Every page shows live data (availability, prices, bookings), so nothing is prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Atelier Events · Event management (demo)', template: '%s · Atelier Events (demo)' },
  description: 'Demonstration website for an event management company: services, enquiries, quotations and bookings. Sample content.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#3d121e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <DemoBar />
        <SiteHeader brandMark={<span>Atelier <em style={{ color: 'var(--accent)' }}>Events</em></span>} nav={shell.nav} cta={shell.cta} />
        <main id="main">{children}</main>
        <SiteFooter shell={shell} email="events@example.com" tagline="Gatherings, considered in every detail. A demonstration website by Infinity Web & Apps." />
      </body>
    </html>
  );
}
