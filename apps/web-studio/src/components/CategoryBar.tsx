'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Light strip under the header: categories on the left, utility links on the right (BookMyShow layout). */
export function CategoryBar({ categories }: { categories: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const left = [{ href: '/services', label: 'All services' }, ...categories.map((c) => ({ href: `/services/${c.slug}`, label: c.name })), { href: '/offers', label: 'Offers' }];
  const right = [{ href: '/enquire', label: 'Request a quote' }, { href: '/portfolio', label: 'Portfolio' }, { href: '/studio', label: 'Studios' }];
  return (
    <nav className="st-catbar" aria-label="Categories">
      <div className="st-catbar__inner">
        <ul>
          {left.map((i) => <li key={i.href}><Link href={i.href} aria-current={pathname === i.href ? 'page' : undefined}>{i.label}</Link></li>)}
        </ul>
        <ul className="st-catbar__right">
          {right.map((i) => <li key={i.href}><Link href={i.href} aria-current={pathname === i.href ? 'page' : undefined}>{i.label}</Link></li>)}
        </ul>
      </div>
    </nav>
  );
}
