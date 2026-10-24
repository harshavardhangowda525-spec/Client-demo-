import type { SiteShell } from '@studio/ui';

export const BRAND = 'PODCAST' as const;

export const shell: SiteShell = {
  brand: BRAND,
  name: 'Signal Room',
  nav: [
    { href: '/studios', label: 'Studios' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/services', label: 'Services' },
    { href: '/packages', label: 'Pricing' },
    { href: '/availability', label: 'Availability' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/locations', label: 'Locations' },
    { href: '/contact', label: 'Contact' },
  ],
  cta: { href: '/book', label: 'Book studio time' },
  footerColumns: [
    {
      title: 'Studio',
      links: [
        { href: '/studios', label: 'Studio overview' },
        { href: '/facilities', label: 'Facilities & equipment' },
        { href: '/services', label: 'Recording services' },
        { href: '/packages', label: 'Packages & pricing' },
      ],
    },
    {
      title: 'Book',
      links: [
        { href: '/availability', label: 'Availability calendar' },
        { href: '/book', label: 'Book a session' },
        { href: '/booking-status', label: 'Booking status' },
        { href: '/faqs', label: 'FAQs' },
      ],
    },
  ],
  siblings: [
    { label: 'Lumen Studio · photography & film', href: process.env.SITE_URL_PHOTO ?? 'http://localhost:3001' },
    { label: 'Atelier Events · event management', href: process.env.SITE_URL_EVENTS ?? 'http://localhost:3003' },
  ],
};
