import type { PublicService } from '@studio/core';

export type Brand = 'PHOTO' | 'PODCAST' | 'EVENTS' | 'STUDIO';
export type { PublicService };

export interface SiteConfig {
  brand: Brand;
  site: { name: string; tagline: string; email: string; phone?: string; social?: Record<string, string | undefined> };
  business: { name: string; isDemo: boolean };
  regional: { timezone: string; currency: string; locale: string };
  bookingRules: { leadTimeHours: number; maxAdvanceDays: number; holdMinutes: number; allowGuestBookings: boolean; isDemoAvailability: boolean };
  pricing: { taxLabel: string; taxRateBps: number; depositBps: number; isSample: boolean };
  cancellationPolicy: { text: string; isSample: boolean };
  integrations: { paymentsMode: 'demo' | 'live' | 'disabled'; paymentsSimulated: boolean; mapsEmbedKey: string | null; emailDelivery: boolean; whatsappDelivery?: boolean };
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isDemo: boolean;
}

export interface Catalog {
  categories: Category[];
  services: PublicService[];
}

export interface PublicLocation {
  id: string;
  slug: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  imageKey: string | null;
  latitude: number | null;
  longitude: number | null;
  isDemo: boolean;
  openingHours: { dayOfWeek: number; open: string; close: string; isDemo: boolean }[];
  resources: { id: string; name: string; type: string; description: string | null; capacity: number | null; isDemo: boolean }[];
}

export interface PortfolioItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: string;
  coverAlt: string;
  category: { slug: string; name: string } | null;
  isSample: boolean;
}

export interface PortfolioDetail extends PortfolioItem {
  body: string;
  images: { id: string; imageKey: string; alt: string; caption: string | null }[];
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  isDemo: boolean;
}

export interface PriceLine {
  kind: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}

export interface PriceBreakdown {
  currency: string;
  durationMin: number;
  lines: PriceLine[];
  subtotalMinor: number;
  discountMinor: number;
  feesMinor: number;
  taxMinor: number;
  taxLabel: string;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
}

export interface BookingDto {
  reference: string;
  brand: Brand;
  status: string;
  statusLabel: string;
  statusDescription: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  service: { id: string; name: string; slug: string };
  package: { id: string; name: string } | null;
  location: { name: string; addressLine1: string; addressLine2: string | null; city: string; isDemo: boolean };
  startsAt: string;
  endsAt: string;
  timezone: string;
  durationMin: number;
  attendees: number | null;
  currency: string;
  items: PriceLine[];
  subtotalMinor: number;
  discountMinor: number;
  feesMinor: number;
  taxMinor: number;
  totalMinor: number;
  depositMinor: number;
  amountPaidMinor: number;
  amountRefundedMinor: number;
  balanceDueMinor: number;
  holdExpiresAt: string | null;
  contact: { name: string; email: string; phone: string | null };
  customerNotes: string | null;
  cancellationReason: string | null;
  isDemo: boolean;
  history: { status: string; label: string; at: string; reason: string | null }[];
  payments: { type: string; status: string; amountMinor: number; isSimulated: boolean; at: string }[];
  actions: { canPayDeposit: boolean; canPayBalance: boolean; canCancel: boolean; canRequestCancellation: boolean; canRequestReschedule?: boolean };
  sourceSite?: Brand | null;
  rescheduleRequests?: { id: string; status: string; requestedStart: string; reason: string | null; decisionNote: string | null; createdAt: string }[];
  createdAt: string;
}

export interface Me {
  user: { id: string; name: string; email: string; role: string; isStaff: boolean; permissions: string[] };
  profile: { id: string; fullName: string; email: string; phone: string | null; company: string | null; marketingOptIn: boolean };
}

export interface NavItem {
  href: string;
  label: string;
}

/** Static per-site configuration supplied by each website app. */
export interface SiteShell {
  brand: Brand;
  name: string;
  nav: NavItem[];
  cta: NavItem;
  footerColumns: { title: string; links: NavItem[] }[];
  /** URLs of the sister websites, for the demo cross-links. */
  siblings: { label: string; href: string }[];
}
