import type { Metadata } from 'next';
import Link from 'next/link';
import { DAY_NAMES, formatCalendarDate, formatDuration, formatMoney } from '@studio/ui';
import { getSiteConfig, resolveImage, SampleImage, serverApi } from '@studio/ui/server';
import { Gallery } from '../../../components/Lightbox';
import { MobileBookBar } from '../../../components/MobileBookBar';
import { Rail } from '../../../components/Rail';
import { Reviews, type ReviewList } from '../../../components/Reviews';
import { SaveButton } from '../../../components/SaveButton';
import { priceLabel, ServiceCard } from '../../../components/ServiceCard';
import { todayIn } from '../../../lib/today';
import type { StudioService } from '../../../lib/types';
import { BRAND } from '../../../site';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const s = await serverApi<StudioService>(`/api/v1/studio/services/${encodeURIComponent(slug)}`, { allow404: true });
  return s ? { title: s.name, description: s.summary } : { title: 'Service not found' };
}

const PAYMENT_TEXT = (s: StudioService) => {
  if (s.bookingMode === 'ENQUIRY') return 'Priced by quotation. Payment terms are set out in your quotation.';
  if (s.bookingMode === 'REQUEST') return 'Submit a request; the team confirms it before any payment is due.';
  return s.depositBps >= 10_000 ? 'Full payment online to confirm.' : s.depositBps > 0 ? `Pay a ${s.depositBps / 100}% deposit online to confirm; the balance is due before the session.` : 'No advance payment needed.';
};

const durationText = (s: StudioService) =>
  s.packages.length ? `${formatDuration(Math.min(...s.packages.map((p) => p.durationMin)))}+` : s.minDurationMin === s.maxDurationMin ? formatDuration(s.minDurationMin) : `${formatDuration(s.minDurationMin)} – ${formatDuration(s.maxDurationMin)}`;

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  const [s, site, reviews] = await Promise.all([
    serverApi<StudioService>(`/api/v1/studio/services/${encodeURIComponent(slug)}`),
    getSiteConfig(BRAND),
    serverApi<ReviewList>(`/api/v1/studio/services/${encodeURIComponent(slug)}/reviews`, { allow404: true }),
  ]);
  if (!s) throw new Error('Service unavailable');
  const today = todayIn(site.regional.timezone);
  const isQuote = s.bookingMode === 'ENQUIRY';
  const bookHref = isQuote ? `/enquire?service=${s.slug}` : `/service/${s.slug}/slots`;
  const bookLabel = isQuote ? 'Request a quote' : s.bookingMode === 'REQUEST' ? 'Request a booking' : 'Book';
  const gallery = s.galleryImageKeys.map((k, i) => {
    const img = resolveImage(k);
    return { key: `${k}-${i}`, src: img.src, alt: img.alt, thumb: <SampleImage imageKey={k} ratio="4x3" sizes="(min-width: 760px) 25vw, 50vw" /> };
  });

  return (
    <div className="st-has-mobilebar">
      {/* Showcase band (BookMyShow movie-page layout) */}
      <section className="st-showcase" aria-labelledby="svc-title">
        <div className="st-showcase__bg" aria-hidden="true"><SampleImage imageKey={s.imageKey} alt="" ratio="auto" sizes="100vw" /></div>
        <div className="container st-showcase__inner">
          <div className="st-showcase__poster"><SampleImage imageKey={s.imageKey} ratio="3x4" sizes="260px" priority /></div>
          <div>
            <h1 id="svc-title">{s.name}</h1>
            <div className="st-ratebox">
              {s.rating ? (
                <>
                  <span className="star" aria-hidden="true">★</span>
                  <b>{s.rating.average.toFixed(1)}/5</b>
                  <span className="muted">{s.rating.count} {s.rating.count === 1 ? 'review' : 'reviews'} from customers who booked</span>
                </>
              ) : (
                <span className="muted">No reviews yet · reviews come only from customers who completed a booking</span>
              )}
            </div>
            <div className="st-tags">
              {s.categories.map((c) => <span key={c.slug}>{c.name}</span>)}
              <span>{s.bookingMode === 'DIRECT' ? 'Instant booking' : s.bookingMode === 'REQUEST' ? 'Booking on request' : 'Custom quotation'}</span>
            </div>
            <p className="st-meta-line">{priceLabel(s)} · {durationText(s)} · {s.cities.join(', ') || 'Location on request'}</p>
            <div className="cluster">
              <Link href={bookHref} className="st-book-btn">{bookLabel}</Link>
              <SaveButton serviceId={s.id} serviceName={s.name} variant="button" />
            </div>
            {s.nextAvailable && <p className="small" style={{ marginTop: 'var(--space-3)' }}>Next free: {s.nextAvailable.date === today ? 'Today' : formatCalendarDate(s.nextAvailable.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {s.nextAvailable.startTime} · {s.nextAvailable.city}</p>}
          </div>
        </div>
      </section>

      <div className="container st-detail-body">
        <nav aria-label="Breadcrumb" className="small" style={{ marginBottom: 'calc(var(--space-4) * -1)' }}>
          <Link href="/services">Services</Link>
          {s.categories[0] && <> › <Link href={`/services/${s.categories[0].slug}`}>{s.categories[0].name}</Link></>}
          {' › '}<span aria-current="page">{s.name}</span>
        </nav>

        <section aria-labelledby="about">
          <h2 id="about">About this service</h2>
          {s.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          <dl className="st-facts" style={{ marginTop: 'var(--space-4)' }}>
            <div><dt>Duration</dt><dd>{durationText(s)}</dd></div>
            <div><dt>Booking</dt><dd>{s.bookingMode === 'DIRECT' ? 'Instant' : s.bookingMode === 'REQUEST' ? 'On request' : 'By quotation'}</dd></div>
            <div><dt>Locations</dt><dd>{s.cities.join(', ') || '—'}</dd></div>
            <div><dt>Payment</dt><dd style={{ fontWeight: 500, fontSize: '0.86rem' }}>{PAYMENT_TEXT(s)}</dd></div>
          </dl>
        </section>

        {gallery.length > 0 && (
          <section aria-labelledby="photos">
            <h2 id="photos">Photos</h2>
            <Gallery items={gallery} />
            <p className="small muted">AI-generated sample imagery.</p>
          </section>
        )}

        {s.packages.length > 0 && (
          <section aria-labelledby="packages">
            <h2 id="packages">Packages</h2>
            {s.pricing.isSample && <p className="badge badge--demo">Sample prices</p>}
            <div className="grid grid--3">
              {s.packages.map((p) => (
                <div key={p.id} className="st-panel stack" style={{ gap: 'var(--space-2)', borderColor: p.isFeatured ? 'var(--accent)' : undefined }}>
                  {p.isFeatured && <span className="badge badge--accent" style={{ width: 'fit-content' }}>Most chosen</span>}
                  <h3 style={{ margin: 0, fontSize: '1.02rem' }}>{p.name}</h3>
                  <p style={{ margin: 0 }}><strong>{formatMoney(p.priceMinor)}</strong> <span className="small muted">· {formatDuration(p.durationMin)}</span></p>
                  {p.description && <p className="small muted" style={{ margin: 0 }}>{p.description}</p>}
                  <ul className="small" style={{ margin: 0, paddingLeft: '1.1em' }}>{p.includes.map((x) => <li key={x}>{x}</li>)}</ul>
                  {!isQuote && <Link className="btn btn--sm" style={{ marginTop: 'auto' }} href={`/service/${s.slug}/slots?package=${p.id}`}>Book {p.name}</Link>}
                </div>
              ))}
            </div>
          </section>
        )}

        {s.addOns.length > 0 && (
          <section aria-labelledby="addons">
            <h2 id="addons">Add-ons</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">Add-on</th><th scope="col">Price</th></tr></thead>
                <tbody>{s.addOns.map((a) => <tr key={a.id}><td>{a.name}{a.description && <span className="small muted" style={{ display: 'block' }}>{a.description}</span>}</td><td>{formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? ' / hour' : ''}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="small muted">Add these at checkout.</p>
          </section>
        )}

        {s.equipment.length > 0 && (
          <section aria-labelledby="equipment">
            <h2 id="equipment">Equipment &amp; facilities</h2>
            <ul className="grid grid--3" style={{ listStyle: 'none', padding: 0 }}>
              {s.equipment.map((e) => (
                <li key={e.id} className="st-panel" style={{ padding: 'var(--space-4)' }}>
                  <strong>{e.name}</strong> {!e.isVerified && <span className="badge badge--demo">Awaiting verification</span>}
                  <span className="small muted" style={{ display: 'block' }}>{e.category}{e.description ? ` · ${e.description}` : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.preparation && (
          <section aria-labelledby="prep">
            <h2 id="prep">How to prepare</h2>
            {s.preparation.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
          </section>
        )}

        <section aria-labelledby="where">
          <h2 id="where">Studios</h2>
          <div className="grid grid--2">
            {s.locations.map((l) => (
              <div key={l.id} className="st-panel">
                <strong>{l.name}</strong>
                <p className="small muted" style={{ margin: 0 }}>{l.addressLine1}, {l.city}</p>
                {l.isDemo && <p className="small muted" style={{ margin: 0 }}>Demonstration address.</p>}
                {l.openingHours.length > 0 && (
                  <details style={{ marginTop: 'var(--space-2)' }}>
                    <summary className="small">Opening hours</summary>
                    <ul className="small" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {l.openingHours.map((h, i) => <li key={i}>{DAY_NAMES[h.dayOfWeek]}: {h.open}–{h.close}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="reviews-title">
          <h2 id="reviews-title">Ratings &amp; reviews</h2>
          <Reviews data={reviews} />
        </section>

        <section aria-labelledby="policy">
          <h2 id="policy">Cancellation policy</h2>
          <p>{s.cancellationPolicy.text}</p>
          {s.cancellationPolicy.isSample && <p className="small muted">Sample policy text; the business will confirm its own. <Link href="/policies/cancellation-refund">Read the full policy</Link>.</p>}
        </section>

        {s.portfolio.length > 0 && (
          <section aria-labelledby="work">
            <h2 id="work">Related work</h2>
            <div className="st-grid">
              {s.portfolio.map((p) => (
                <Link key={p.id} href={`/portfolio#${p.slug}`} className="st-card">
                  <div className="st-card__poster"><SampleImage imageKey={p.coverImage} alt={p.coverAlt} ratio="16x9" sizes="(min-width: 1000px) 25vw, 50vw" /></div>
                  <span className="st-card__title">{p.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {s.related.length > 0 && (
          <section aria-labelledby="related">
            <div className="st-section__head"><h2 id="related" style={{ margin: 0 }}>You might also like</h2></div>
            <Rail label="Related services">{s.related.map((r) => <ServiceCard key={r.id} s={r} today={today} />)}</Rail>
          </section>
        )}
      </div>

      <MobileBookBar price={priceLabel(s)} label={bookLabel} href={bookHref} />
    </div>
  );
}
