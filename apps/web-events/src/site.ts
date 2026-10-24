import type { SiteShell } from '@studio/ui';

export const BRAND = 'EVENTS' as const;

export const shell: SiteShell = {
  brand: BRAND,
  name: 'Atelier Events',
  nav: [
    { href: '/services', label: 'Services' },
    { href: '/categories', label: 'Occasions' },
    { href: '/packages', label: 'Packages' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/venues', label: 'Venues' },
    { href: '/book', label: 'Consultations' },
    { href: '/contact', label: 'Contact' },
  ],
  cta: { href: '/enquire', label: 'Plan an event' },
  footerColumns: [
    {
      title: 'Events',
      links: [
        { href: '/services', label: 'Event services' },
        { href: '/categories', label: 'Event categories' },
        { href: '/packages', label: 'Packages' },
        { href: '/gallery', label: 'Gallery' },
      ],
    },
    {
      title: 'Plan',
      links: [
        { href: '/enquire', label: 'Send an enquiry' },
        { href: '/book', label: 'Book a consultation' },
        { href: '/enquiry-status', label: 'Enquiry status' },
        { href: '/booking-status', label: 'Booking status' },
        { href: '/faqs', label: 'FAQs' },
      ],
    },
  ],
  siblings: [
    { label: 'Lumen Studio · photography & film', href: process.env.SITE_URL_PHOTO ?? 'http://localhost:3001' },
    { label: 'Signal Room · podcast studios', href: process.env.SITE_URL_PODCAST ?? 'http://localhost:3002' },
  ],
};
