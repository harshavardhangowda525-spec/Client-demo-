'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { NavItem } from '../lib/types';

export function SiteHeader({ brandMark, nav, cta, accountHref = '/account' }: { brandMark: ReactNode; nav: NavItem[]; cta: NavItem; accountHref?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand-mark">
          {brandMark}
        </Link>
        <nav className="site-nav" aria-label="Main">
          <ul>
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="header-actions">
          <Link href={accountHref} className="btn btn--ghost btn--sm header-cta">
            Account
          </Link>
          <Link href={cta.href} className="btn btn--sm header-cta">
            {cta.label}
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="menu-toggle__bar" aria-hidden="true" />
            <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>
      <div id={menuId} className="mobile-nav" hidden={!open}>
        <nav className="container" aria-label="Mobile">
          <ul>
            {[...nav, { href: accountHref, label: 'My account' }, cta].map((item) => (
              <li key={item.href + item.label}>
                <Link href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
