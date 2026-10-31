import Link from 'next/link';
import { FaqList, formatDuration, formatMoney } from '@studio/ui';
import { resolveImage, SampleImage, serverApi } from '@studio/ui/server';
import { HeroCarousel } from '../components/HeroCarousel';
import { Gallery } from '../components/Lightbox';
import { OfferCard } from '../components/OfferCard';
import { Rail } from '../components/Rail';
import { ServiceCard } from '../components/ServiceCard';
import { getCity } from '../lib/city';
import { todayIn } from '../lib/today';
import type { StudioHome } from '../lib/types';

export default async function Home() {
  const city = await getCity();
  const home = (await serverApi<StudioHome>(`/api/v1/studio/home${city ? `?city=${encodeURIComponent(city)}` : ''}`))!;
  const today = todayIn();
  const verifiedEquipment = home.equipment.some((e) => e.isVerified);

  return (
    <>
      <div className="container">
        <HeroCarousel
          slides={home.banners.map((b, i) => ({
            id: b.id,
            title: b.title,
            subtitle: b.subtitle,
            ctaLabel: b.ctaLabel,
            ctaHref: b.ctaHref,
            offerText: b.offerText,
            media: <SampleImage imageKey={b.imageKey} alt={b.imageAlt ?? ''} ratio="auto" sizes="(min-width: 1240px) 1240px, 100vw" priority={i === 0} />,
          }))}
        />
        {!home.banners.length && (
          <section className="st-panel" style={{ marginTop: 'var(--space-5)' }}>
            <h1 style={{ margin: 0 }}>{home.site.name}</h1>
            <p className="lead" style={{ margin: 0 }}>{home.site.tagline}</p>
          </section>
        )}
      </div>

      {/* Recommended (ranked by real bookings) */}
      <section className="st-section" aria-labelledby="popular">
        <div className="container">
          <div className="st-section__head">
            <h2 id="popular">Recommended services{city ? ` in ${city}` : ''}</h2>
            <Link href="/services?sort=popular">See all</Link>
          </div>
          {home.popular.length ? (
            <Rail label="Recommended services">
              {home.popular.map((s, i) => <ServiceCard key={s.id} s={s} today={today} priority={i < 2} />)}
            </Rail>
          ) : (
            <div className="empty">No services are available{city ? ` in ${city}` : ''} yet. <Link href="/services">Browse all services</Link>.</div>
          )}
        </div>
      </section>

      {/* Offers */}
      {home.offers.length > 0 && (
        <section className="st-section" aria-labelledby="offers" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="st-section__head">
              <h2 id="offers">Offers for you</h2>
              <Link href="/offers">All offers</Link>
            </div>
            <div className="st-offers">
              {home.offers.slice(0, 3).map((o) => <OfferCard key={o.id} offer={o} />)}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="st-section st-band" aria-labelledby="cats">
        <div className="container">
          <div className="st-section__head"><h2 id="cats">Explore by category</h2></div>
          <div className="st-tiles">
            {home.categories.map((c) => (
              <Link key={c.id} href={`/services/${c.slug}`} className="st-tile">
                <SampleImage imageKey={c.imageKey} alt="" ratio="auto" sizes="(min-width: 1100px) 12vw, (min-width: 760px) 25vw, 50vw" />
                <span>{c.name}<small>{c.serviceCount} {c.serviceCount === 1 ? 'service' : 'services'}</small></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured: dark "premiere" band */}
      {home.featured.length > 0 && (
        <section className="st-section st-dark" aria-labelledby="featured">
          <div className="container">
            <div className="st-section__head">
              <div>
                <h2 id="featured">Featured this week</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>Hand-picked by the studio team</p>
              </div>
              <Link href="/services">See all</Link>
            </div>
            <Rail label="Featured services">
              {home.featured.map((s) => <ServiceCard key={s.id} s={s} today={today} />)}
            </Rail>
          </div>
        </section>
      )}

      {/* Packages */}
      {home.packages.length > 0 && (
        <section className="st-section" aria-labelledby="pkgs">
          <div className="container">
            <div className="st-section__head">
              <h2 id="pkgs">Popular packages</h2>
              <Link href="/packages">All packages</Link>
            </div>
            {home.pricing.isSample && <p className="badge badge--demo" style={{ marginBottom: 'var(--space-4)' }}>Sample prices</p>}
            <Rail label="Packages">
              {home.packages.map((p) => (
                <div key={p.id} className="st-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span className="small muted">{p.service.name}</span>
                  <h3 style={{ margin: 0, fontSize: '1.02rem' }}>{p.name}</h3>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem' }}>{formatMoney(p.priceMinor)}</p>
                  <p className="small muted" style={{ margin: 0 }}>{formatDuration(p.durationMin)} · plus {home.pricing.taxLabel}</p>
                  <ul className="small" style={{ paddingLeft: '1.1em', margin: 0 }}>{p.includes.slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>
                  <Link className="btn btn--sm" style={{ marginTop: 'auto' }} href={`/service/${p.service.slug}/slots?package=${p.id}`}>Book</Link>
                </div>
              ))}
            </Rail>
          </div>
        </section>
      )}

      {/* Studios & equipment */}
      <section className="st-section st-band" aria-labelledby="facilities">
        <div className="container">
          <div className="st-section__head">
            <h2 id="facilities">Studios &amp; equipment</h2>
            <Link href="/studio">Studio details</Link>
          </div>
          {!verifiedEquipment && home.equipment.length > 0 && (
            <p className="alert alert--info small">Equipment listed here is generic sample data awaiting confirmation by the studio. Exact models will be shown once verified.</p>
          )}
          <div className="st-feature">
            <Gallery
              items={home.portfolio.slice(0, 4).map((p) => ({ key: p.id, thumb: <SampleImage imageKey={p.coverImage} alt={p.coverAlt} ratio="4x3" sizes="(min-width: 760px) 25vw, 50vw" />, src: resolveImage(p.coverImage).src, alt: p.coverAlt, caption: p.title }))}
              className="st-gallery"
            />
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {home.equipment.slice(0, 6).map((e) => (
                <li key={e.id} className="cluster" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
                  <span><strong>{e.name}</strong><br /><span className="small muted">{e.category}</span></span>
                  {!e.isVerified && <span className="badge badge--demo">Awaiting verification</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Why book here: only claims the platform actually delivers */}
      <section className="st-section" aria-labelledby="why">
        <div className="container">
          <div className="st-section__head"><h2 id="why">Why book here</h2></div>
          <div className="st-highlights">
            {home.highlights.map((h, i) => (
              <div key={h.title}>
                <span className="num" aria-hidden="true">{i + 1}</span>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent work */}
      {home.portfolio.length > 0 && (
        <section className="st-section st-band" aria-labelledby="work">
          <div className="container">
            <div className="st-section__head">
              <h2 id="work">Recent work</h2>
              <Link href="/portfolio">Full portfolio</Link>
            </div>
            <Rail label="Recent work">
              {home.portfolio.map((p) => (
                <Link key={p.id} href={`/portfolio#${p.slug}`} className="st-card">
                  <div className="st-card__poster"><SampleImage imageKey={p.coverImage} alt={p.coverAlt} ratio="4x3" sizes="(min-width: 1000px) 18vw, 46vw" /></div>
                  <span className="st-card__title">{p.title}</span>
                  <span className="st-card__meta">{p.category?.name}{p.videoUrl ? ' · Video' : ''}</span>
                </Link>
              ))}
            </Rail>
            {home.portfolio.some((p) => p.isSample) && <p className="small muted">Sample projects with AI-generated imagery.</p>}
          </div>
        </section>
      )}

      {/* Testimonials: rendered only when authorised testimonials exist */}
      {home.testimonials.length > 0 && (
        <section className="st-section" aria-labelledby="reviews">
          <div className="container">
            <div className="st-section__head"><h2 id="reviews">What clients say</h2></div>
            <div className="grid grid--3">
              {home.testimonials.map((t) => (
                <figure key={t.id} className="st-panel" style={{ margin: 0 }}>
                  <blockquote style={{ margin: 0 }}>&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="small muted" style={{ marginTop: 'var(--space-3)' }}>{t.authorName}{t.authorDetail ? `, ${t.authorDetail}` : ''}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {home.faqs.length > 0 && (
        <section className="st-section" aria-labelledby="faq">
          <div className="container container--narrow" style={{ marginInline: 'auto' }}>
            <div className="st-section__head">
              <h2 id="faq">Frequently asked questions</h2>
              <Link href="/faqs">All FAQs</Link>
            </div>
            {home.faqs.some((f) => f.isDemo) && <p className="badge badge--demo" style={{ marginBottom: 'var(--space-4)' }}>Sample answers for demonstration</p>}
            <FaqList faqs={home.faqs.slice(0, 5)} />
          </div>
        </section>
      )}

      <section className="st-section" aria-labelledby="cta">
        <div className="container">
          <div className="st-panel cluster" style={{ justifyContent: 'space-between', background: 'var(--ink)', color: '#fff', border: 0 }}>
            <div>
              <h2 id="cta" style={{ color: '#fff', margin: 0 }}>Planning something bigger?</h2>
              <p style={{ color: 'var(--ink-text)', margin: 0 }}>Campaigns, events and multi-day shoots: send a brief and get a custom quotation.</p>
            </div>
            <Link href="/enquire" className="btn btn--light">Request a quote</Link>
          </div>
        </div>
      </section>
    </>
  );
}
