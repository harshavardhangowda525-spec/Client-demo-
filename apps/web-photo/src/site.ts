import type { SiteShell } from '@studio/ui';

export const BRAND = 'PHOTO' as const;

export const shell: SiteShell = {
  brand: BRAND,
  name: 'Lumen Studio',
  nav: [
    { href: '/photography', label: 'Photography' },
    { href: '/videography', label: 'Videography' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/packages', label: 'Packages' },
    { href: '/locations', label: 'Studio' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ],
  cta: { href: '/book', label: 'Book a session' },
  footerColumns: [
    {
      title: 'Services',
      links: [
        { href: '/photography', label: 'Photography' },
        { href: '/videography', label: 'Videography' },
        { href: '/packages', label: 'Packages & pricing' },
        { href: '/portfolio', label: 'Portfolio' },
      ],
    },
    {
      title: 'Help',
      links: [
        { href: '/book', label: 'Book a session' },
        { href: '/booking-status', label: 'Booking status' },
        { href: '/faqs', label: 'FAQs' },
        { href: '/account', label: 'My account' },
      ],
    },
  ],
  siblings: [
    { label: 'Signal Room · podcast studios', href: process.env.SITE_URL_PODCAST ?? 'http://localhost:3002' },
    { label: 'Atelier Events · event management', href: process.env.SITE_URL_EVENTS ?? 'http://localhost:3003' },
  ],
};
