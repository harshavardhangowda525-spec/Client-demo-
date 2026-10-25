'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { api } from '@studio/ui';
import { AdminContext, type AdminUser } from '../lib/client';

const NAV: { title: string; items: { href: string; label: string; perm: string }[] }[] = [
  { title: 'Operations', items: [
    { href: '/', label: 'Dashboard', perm: 'bookings.read' },
    { href: '/bookings', label: 'Bookings', perm: 'bookings.read' },
    { href: '/reschedule-requests', label: 'Reschedule requests', perm: 'bookings.read' },
    { href: '/enquiries', label: 'Enquiries & briefs', perm: 'enquiries.read' },
    { href: '/customers', label: 'Customers', perm: 'customers.read' },
    { href: '/payments', label: 'Payments', perm: 'payments.read' },
  ] },
  { title: 'Catalogue', items: [
    { href: '/services', label: 'Services & packages', perm: 'catalog.read' },
    { href: '/locations', label: 'Locations & resources', perm: 'catalog.read' },
    { href: '/content', label: 'Content & messages', perm: 'content.manage' },
    { href: '/studio-site', label: 'Studio site', perm: 'content.manage' },
  ] },
  { title: 'System', items: [
    { href: '/settings', label: 'Configuration', perm: 'settings.read' },
    { href: '/integrations', label: 'Integrations', perm: 'settings.read' },
    { href: '/notifications', label: 'Notifications', perm: 'notifications.read' },
    { href: '/audit', label: 'Audit log', perm: 'audit.read' },
    { href: '/users', label: 'Staff & roles', perm: 'users.manage' },
  ] },
];

export function AdminShell({ user, children }: { user: AdminUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <AdminContext.Provider value={user}>
      <div className="admin">
        <aside className="admin-nav" aria-label="Admin navigation">
          <p style={{ fontWeight: 600, margin: '0 0 var(--space-2) 0.6rem' }}>Studio Admin</p>
          <p className="small" style={{ color: '#8a91a0', margin: '0 0 var(--space-4) 0.6rem' }}>{user.name} · {user.role}</p>
          <nav>
            {NAV.map((group) => {
              const items = group.items.filter((i) => user.permissions.includes(i.perm));
              if (!items.length) return null;
              return (
                <div key={group.title}>
                  <h2>{group.title}</h2>
                  <ul>
                    {items.map((i) => (
                      <li key={i.href}><Link href={i.href} aria-current={current(i.href) ? 'page' : undefined}>{i.label}</Link></li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
          <button type="button" className="btn btn--ghost btn--sm" style={{ color: '#c9cdd6', borderColor: '#3a3f4a', marginLeft: '0.6rem' }} onClick={async () => { await api('/api/auth/sign-out', { body: {} }); router.refresh(); }}>
            Sign out
          </button>
        </aside>
        <main id="main" className="admin-main">{children}</main>
      </div>
    </AdminContext.Provider>
  );
}
