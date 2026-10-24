import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@studio/ui/styles.css';
import './theme.css';
import { AuthPanel } from '@studio/ui';
import { getMe } from '@studio/ui/server';
import { AdminShell } from '../components/AdminShell';
import { SignOutButton } from '../components/SignOutButton';

// Every page shows live data (availability, prices, bookings), so nothing is prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Studio Admin' }, robots: { index: false, follow: false } };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  let body: React.ReactNode;
  if (!me) {
    body = (
      <main className="container section" style={{ maxWidth: 560 }}>
        <h1>Studio admin</h1>
        <p className="muted">Sign in with a staff account. Demo: <span className="mono">admin@demo.example</span> / <span className="mono">DemoAdmin!2026</span></p>
        <AuthPanel emailDelivery={false} allowRegister={false} demoAccount={{ email: 'admin@demo.example', password: 'DemoAdmin!2026', label: 'Demo administrator' }} />
      </main>
    );
  } else if (!me.user.isStaff) {
    body = (
      <main className="container section">
        <h1>Not authorised</h1>
        <p>This account ({me.user.email}) does not have access to the admin panel.</p>
        <p className="muted">Sign out, then sign in with a staff account (demo: <span className="mono">admin@demo.example</span> / <span className="mono">DemoAdmin!2026</span>).</p>
        <SignOutButton label="Sign out and use a staff account" />
      </main>
    );
  } else {
    body = <AdminShell user={{ id: me.user.id, name: me.user.name, email: me.user.email, role: me.user.role, permissions: me.user.permissions }}>{children}</AdminShell>;
  }
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        {body}
      </body>
    </html>
  );
}
