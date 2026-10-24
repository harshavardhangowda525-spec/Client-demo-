import type { Metadata } from 'next';
import Link from 'next/link';
import { DAY_NAMES, formatCalendarDate, formatDuration, formatMoney } from '@studio/ui';
import { getSiteConfig, resolveImage, SampleImage, serverApi, type SearchParams } from '@studio/ui/server';
import { BookingPanel } from '../../../components/BookingPanel';
import { Gallery } from '../../../components/Lightbox';
import { MobileBookBar } from '../../../components/MobileBookBar';
import { Rail } from '../../../components/Rail';
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

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const [s, site] = await Promise.all([serverApi<StudioService>(`/api/v1/studio/services/${encodeURIComponent(slug)}`), getSiteConfig(BRAND)]);
  if (!s) throw new Error('Service unavailable');
  const today = todayIn(site.regional.timezone);
  const gallery = s.galleryImageKeys.map((k, i) => {
    const img = resolveImage(k);
    return { key: `${k}-${i}`, src: img.src, alt: img.alt, thumb: <SampleImage imageKey={k} ratio={i === 0 ? '4x3' : '4x3'} sizes={i === 0 ? '(min-width: 1000px) 40vw, 66vw' : '(min-width: 1000px) 20vw, 33vw'} priority={i === 0} /> };
  });

  return (
    <div className="container st-has-mobilebar">
      <nav aria-label="Breadcrumb" className="small" style={{ marginTop: 'var(--space-4)' }}>
        <Link href="/services">Services</Link>
        {s.categories[0] && <> › <Link href={`/services/${s.categories[0].slug}`}>{s.categories[0].name}</Link></>}
        {' › '}<span aria-current="page">{s.name}</span>
      </nav>

      <div className="st-detail">
        <div className="stack-lg" style={{ minWidth: 0 }}>
          <header className="stack" style={{ gap: 'var(--space-2)' }}>
            <div className="st-chips">{s.categories.map((c) => <Link key={c.slug} href={`/services/${c.slug}`} className="badge badge--accent" style={{ textDecoration: 'none' }}>{c.name}</Link>)}</div>
            <h1 style={{ margin: 0 }}>{s.name}</h1>
            <p className="lead" style={{ margin: 0 }}>{s.summary}</p>
            <div className="cluster">
              <strong style={{ fontSize: '1.15rem' }}>{priceLabel(s)}</strong>
              {s.nextAvailable && <span className="st-avail">Next free: {s.nextAvailable.date === today ? 'Today' : formatCalendarDate(s.nextAvailable.date, { weekday: 'short', day: 'numeric', month: 'short' })}, {s.nextAvailable.startTime}</span>}
              <SaveButton serviceId={s.id} serviceName={s.name} variant="button" />
            </div>
          </header>

          {gallery.length > 0 && (gallery.length > 1 ? <Gallery items={gallery} className="st-detail__gallery" /> : <Gallery items={gallery} className="" />)}
          {gallery.length > 0 && <p className="small muted" style={{ marginTop: 'calc(var(--space-4) * -1)' }}>AI-generated sample imagery.</p>}

          <dl className="st-facts">
            <div><dt>Duration</dt><dd>{s.packages.length ? `${formatDuration(Math.min(...s.packages.map((p) => p.durationMin)))}+` : s.minDurationMin === s.maxDurationMin ? formatDuration(s.minDurationMin) : `${formatDuration(s.minDurationMin)} – ${formatDuration(s.maxDurationMin)}`}</dd></div>
            <div><dt>Booking</dt><dd>{s.bookingMode === 'DIRECT' ? 'Instant' : s.bookingMode === 'REQUEST' ? 'On request' : 'By quotation'}</dd></div>
            <div><dt>Locations</dt><dd>{s.cities.join(', ') || '—'}</dd></div>
            <div><dt>Payment</dt><dd style={{ fontWeight: 600, fontSize: '0.88rem' }}>{PAYMENT_TEXT(s)}</dd></div>
          </dl>

          {s.description && (
            <section aria-labelledby="about">
              <h2 id="about" style={{ fontSize: 'var(--step-2)' }}>About this service</h2>
              {s.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          )}

          {s.packages.length > 0 && (
            <section aria-labelledby="packages">
              <h2 id="packages" style={{ fontSize: 'var(--step-2)' }}>Packages</h2>
              {s.pricing.isSample && <p className="badge badge--demo">Sample prices</p>}
              <div className="grid grid--2">
                {s.packages.map((p) => (
                  <div key={p.id} className="st-panel stack" style={{ gap: 'var(--space-2)', borderColor: p.isFeatured ? 'var(--accent)' : undefined }}>
                    {p.isFeatured && <span className="badge badge--accent" style={{ width: 'fit-content' }}>Most chosen</span>}
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{p.name}</h3>
                    <p style={{ margin: 0 }}><strong>{formatMoney(p.priceMinor)}</strong> <span className="small muted">· {formatDuration(p.durationMin)} · plus {s.pricing.taxLabel}</span></p>
                    {p.description && <p className="small muted" style={{ margin: 0 }}>{p.description}</p>}
                    <ul className="small" style={{ margin: 0, paddingLeft: '1.1em' }}>{p.includes.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {s.addOns.length > 0 && (
            <section aria-labelledby="addons">
              <h2 id="addons" style={{ fontSize: 'var(--step-2)' }}>Add-ons</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th scope="col">Add-on</th><th scope="col">Price</th></tr></thead>
                  <tbody>{s.addOns.map((a) => <tr key={a.id}><td>{a.name}{a.description && <span className="small muted" style={{ display: 'block' }}>{a.description}</span>}</td><td>{formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? ' / hour' : ''}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          {s.equipment.length > 0 && (
            <section aria-labelledby="equipment">
              <h2 id="equipment" style={{ fontSize: 'var(--step-2)' }}>Equipment &amp; facilities</h2>
              <ul className="grid grid--2" style={{ listStyle: 'none', padding: 0 }}>
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
              <h2 id="prep" style={{ fontSize: 'var(--step-2)' }}>How to prepare</h2>
              {s.preparation.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
            </section>
          )}

          <section aria-labelledby="where">
            <h2 id="where" style={{ fontSize: 'var(--step-2)' }}>Where</h2>
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

          <section aria-labelledby="policy">
            <h2 id="policy" style={{ fontSize: 'var(--step-2)' }}>Cancellation policy</h2>
            <p>{s.cancellationPolicy.text}</p>
            {s.cancellationPolicy.isSample && <p className="small muted">Sample policy text; the business will confirm its own. <Link href="/policies/cancellation-refund">Read the full policy</Link>.</p>}
          </section>

          {s.testimonials.length > 0 && (
            <section aria-labelledby="reviews">
              <h2 id="reviews" style={{ fontSize: 'var(--step-2)' }}>Client feedback</h2>
              {s.testimonials.map((t) => (
                <figure key={t.id} className="st-panel" style={{ margin: '0 0 var(--space-3)' }}>
                  <blockquote style={{ margin: 0 }}>&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="small muted">{t.authorName}{t.authorDetail ? `, ${t.authorDetail}` : ''}</figcaption>
                </figure>
              ))}
            </section>
          )}

          {s.portfolio.length > 0 && (
            <section aria-labelledby="work">
              <h2 id="work" style={{ fontSize: 'var(--step-2)' }}>Related work</h2>
              <div className="st-grid">
                {s.portfolio.map((p) => (
                  <Link key={p.id} href={`/portfolio#${p.slug}`} className="st-card">
                    <SampleImage imageKey={p.coverImage} alt={p.coverAlt} ratio="16x9" sizes="(min-width: 1000px) 30vw, 50vw" />
                    <span className="st-card__title">{p.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="st-bookpanel" aria-label="Booking">
          <BookingPanel service={s} site={site} initialPackage={Array.isArray(sp.package) ? sp.package[0] : sp.package} />
        </aside>
      </div>

      {s.related.length > 0 && (
        <section className="st-section" aria-labelledby="related">
          <div className="st-section__head"><h2 id="related">You might also like</h2></div>
          <Rail label="Related services">{s.related.map((r) => <ServiceCard key={r.id} s={r} today={today} />)}</Rail>
        </section>
      )}

      <MobileBookBar price={priceLabel(s)} label={s.bookingMode === 'ENQUIRY' ? 'Request a quote' : 'Choose a slot'} href={s.bookingMode === 'ENQUIRY' ? `/enquire?service=${s.slug}` : '#book'} />
    </div>
  );
}
