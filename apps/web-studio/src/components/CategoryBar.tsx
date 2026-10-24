'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CategoryBar({ categories }: { categories: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const items = [{ href: '/services', label: 'All services' }, ...categories.map((c) => ({ href: `/services/${c.slug}`, label: c.name })), { href: '/portfolio', label: 'Portfolio' }, { href: '/studio', label: 'Studio & equipment' }, { href: '/packages', label: 'Packages' }];
  return (
    <nav className="st-catbar" aria-label="Categories">
      <ul>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={pathname === i.href ? 'page' : undefined}>{i.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
