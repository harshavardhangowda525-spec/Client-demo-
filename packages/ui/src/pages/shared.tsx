import 'server-only';
import { AccountDashboard, AuthPanel, ResetPasswordForm, type AccountBooking, type AccountEnquiry, type AccountPayment } from '../components/AccountView';
import { BookingFlow, type BookingFlowProps } from '../components/BookingFlow';
import { BookingStatusView } from '../components/BookingStatusView';
import { ContactForm } from '../components/ContactForm';
import { FaqList, LegalContent, LocationCard } from '../components/Content';
import { EnquiryStatusView } from '../components/EnquiryStatusView';
import { PageHeader } from '../components/SiteFooter';
import { getCatalog, getMe, getSiteConfig, serverApi } from '../lib/server-api';
import type { Brand, Faq, PublicLocation } from '../lib/types';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function brandSites(): Record<Brand, string> {
  return {
    PHOTO: process.env.SITE_URL_PHOTO ?? 'http://localhost:3001',
    PODCAST: process.env.SITE_URL_PODCAST ?? 'http://localhost:3002',
    EVENTS: process.env.SITE_URL_EVENTS ?? 'http://localhost:3003',
    STUDIO: process.env.SITE_URL_STUDIO ?? 'http://localhost:3004',
  };
}
export const adminUrl = () => process.env.SITE_URL_ADMIN ?? 'http://localhost:3100';

export async function getLocations(brand: Brand) {
  return (await serverApi<PublicLocation[]>(`/api/v1/sites/${brand}/locations`)) ?? [];
}

export async function BookPage({ brand, searchParams, title, lead, labels, showAttendees, serviceFilter }: {
  brand: Brand;
  searchParams: SearchParams;
  title: string;
  lead: string;
  labels?: BookingFlowProps['labels'];
  showAttendees?: boolean;
  serviceFilter?: (s: BookingFlowProps['services'][number]) => boolean;
}) {
  const [sp, site, catalog, locations, me] = await Promise.all([searchParams, getSiteConfig(brand), getCatalog(brand), getLocations(brand), getMe()]);
  const services = catalog.services.filter((s) => s.bookingMode !== 'ENQUIRY').filter(serviceFilter ?? (() => true));
  return (
    <>
      <PageHeader eyebrow="Booking" title={title} lead={lead} />
      <section className="section">
        <div className="container">
          {services.length ? (
            <BookingFlow
              brand={brand}
              site={site}
              services={services}
              locations={locations}
              me={me}
              labels={labels}
              showAttendees={showAttendees}
              initial={{ service: one(sp.service), location: one(sp.location), date: one(sp.date), time: one(sp.time), package: one(sp.package) }}
            />
          ) : (
            <div className="empty">No services can be booked online right now.</div>
          )}
        </div>
      </section>
    </>
  );
}

export async function BookingStatusPage({ brand, searchParams, homeBrands, showReceipt }: { brand: Brand; searchParams: SearchParams; homeBrands?: Brand[]; showReceipt?: boolean }) {
  const [sp, site, me] = await Promise.all([searchParams, getSiteConfig(brand), getMe()]);
  return (
    <>
      <PageHeader eyebrow="Booking status" title="Your booking" lead="Check the status of a booking, pay a deposit or balance, and see its history." />
      <section className="section">
        <div className="container">
          <BookingStatusView site={site} brandSites={brandSites()} initialRef={one(sp.ref)} initialToken={one(sp.token)} isNew={one(sp.new) === '1'} signedIn={!!me} homeBrands={homeBrands} showReceipt={showReceipt} />
        </div>
      </section>
    </>
  );
}

export async function EnquiryStatusPage({ searchParams }: { searchParams: SearchParams }) {
  const [sp, me] = await Promise.all([searchParams, getMe()]);
  return (
    <>
      <PageHeader eyebrow="Enquiry status" title="Your enquiry" lead="Follow your enquiry and review proposals from the team." />
      <section className="section">
        <div className="container container--narrow" style={{ marginInline: 'auto' }}>
          <EnquiryStatusView initialRef={one(sp.ref)} initialToken={one(sp.token)} signedIn={!!me} />
        </div>
      </section>
    </>
  );
}

export async function AccountPage({ brand, searchParams, homeBrands, children, allowGoogle }: { brand: Brand; searchParams: SearchParams; homeBrands?: Brand[]; children?: React.ReactNode; /** Offer Google sign-in (only on the site Google redirects back to). */ allowGoogle?: boolean }) {
  const [sp, site, me] = await Promise.all([searchParams, getSiteConfig(brand), getMe()]);
  if (!me) {
    return (
      <>
        <PageHeader eyebrow="Account" title="Sign in or create an account" lead="One account works across all three websites in this demo." />
        <section className="section">
          <div className="container">
            <AuthPanel next={one(sp.next)} emailDelivery={site.integrations.emailDelivery} adminUrl={adminUrl()} googleSignIn={!!allowGoogle && !!site.integrations.googleSignIn} oauthError={one(sp.error)} />
          </div>
        </section>
      </>
    );
  }
  const [bookings, enquiries, payments] = await Promise.all([
    serverApi<AccountBooking[]>('/api/v1/me/bookings', { auth: true }),
    serverApi<AccountEnquiry[]>('/api/v1/me/enquiries', { auth: true }),
    serverApi<AccountPayment[]>('/api/v1/me/payments', { auth: true }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Account" title={`Hello, ${me.profile.fullName.split(' ')[0]}`} lead="Your bookings, enquiries and payments across all three websites." />
      <section className="section">
        <div className="container">
          <AccountDashboard me={me} bookings={bookings ?? []} enquiries={enquiries ?? []} payments={payments ?? []} brand={brand} brandSites={brandSites()} adminUrl={adminUrl()} homeBrands={homeBrands} />
          {children}
        </div>
      </section>
    </>
  );
}

export async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader eyebrow="Account" title="Choose a new password" />
      <section className="section">
        <div className="container">
          <ResetPasswordForm token={one(sp.token)} />
        </div>
      </section>
    </>
  );
}

export async function FaqPage({ brand, lead }: { brand: Brand; lead?: string }) {
  const faqs = (await serverApi<Faq[]>(`/api/v1/sites/${brand}/faqs`)) ?? [];
  return (
    <>
      <PageHeader eyebrow="Questions" title="Frequently asked questions" lead={lead} />
      <section className="section">
        <div className="container container--narrow" style={{ marginInline: 'auto' }}>
          {faqs.some((f) => f.isDemo) && <p className="badge badge--demo" style={{ marginBottom: 'var(--space-5)' }}>Sample answers for demonstration</p>}
          <FaqList faqs={faqs} />
        </div>
      </section>
    </>
  );
}

export async function ContactPage({ brand, title = 'Get in touch', lead }: { brand: Brand; title?: string; lead?: string }) {
  const [site, locations] = await Promise.all([getSiteConfig(brand), getLocations(brand)]);
  return (
    <>
      <PageHeader eyebrow="Contact" title={title} lead={lead} />
      <section className="section">
        <div className="container split split--wide-left" style={{ alignItems: 'start' }}>
          <ContactForm brand={brand} />
          <aside className="stack">
            <div className="card card--surface stack">
              <p className="label" style={{ margin: 0 }}>Email</p>
              <p style={{ margin: 0 }}><a href={`mailto:${site.site.email}`}>{site.site.email}</a></p>
              <p className="small muted" style={{ margin: 0 }}>Placeholder address for the demo.</p>
            </div>
            {locations.map((l) => (
              <div key={l.id} className="card card--surface">
                <p style={{ margin: 0, fontWeight: 600 }}>{l.name}</p>
                <p className="small muted" style={{ margin: 0 }}>{l.addressLine1}, {l.city}</p>
              </div>
            ))}
          </aside>
        </div>
      </section>
    </>
  );
}

export async function LocationsPage({ brand, title, lead, resourceLabel }: { brand: Brand; title: string; lead: string; resourceLabel?: string }) {
  const [site, locations] = await Promise.all([getSiteConfig(brand), getLocations(brand)]);
  return (
    <>
      <PageHeader eyebrow="Locations" title={title} lead={lead} />
      <section className="section">
        <div className="container grid grid--2">
          {locations.map((l) => (
            <LocationCard key={l.id} location={l} mapsKey={site.integrations.mapsEmbedKey} resourceLabel={resourceLabel} />
          ))}
          {!locations.length && <div className="empty">No locations published yet.</div>}
        </div>
      </section>
    </>
  );
}

export function LegalPage({ kind, siteName }: { kind: 'privacy' | 'terms'; siteName: string }) {
  return (
    <>
      <PageHeader eyebrow="Legal" title={kind === 'privacy' ? 'Privacy notice' : 'Terms of booking'} />
      <section className="section">
        <div className="container container--narrow" style={{ marginInline: 'auto' }}>
          <LegalContent kind={kind} siteName={siteName} />
        </div>
      </section>
    </>
  );
}
