import Link from 'next/link';
import { formatDuration, formatMoney, priceFrom, Reveal } from '@studio/ui';
import { getCatalog, SampleImage, serverApi } from '@studio/ui/server';
import type { PortfolioItem } from '@studio/ui';
import { BRAND } from '../site';

export default async function Home() {
  const [catalog, work] = await Promise.all([getCatalog(BRAND), serverApi<PortfolioItem[]>(`/api/v1/sites/${BRAND}/portfolio`)]);
  const photo = catalog.services.filter((s) => s.category?.slug === 'photography');
  const video = catalog.services.filter((s) => s.category?.slug === 'videography');
  const featured = catalog.services.flatMap((s) => s.packages.map((p) => ({ ...p, service: s }))).sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, 3);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <SampleImage imageKey="photo-hero" ratio="auto" priority sizes="100vw" />
        <div className="container hero__content">
          <span className="eyebrow">Photography &amp; film · Bengaluru (sample)</span>
          <h1 id="hero-title">Images with <em>intent</em>. Stories in light.</h1>
          <p className="lead">Portraits, products, campaigns and films, directed with care and delivered with precision.</p>
          <div className="cluster" style={{ marginTop: 'var(--space-5)' }}>
            <Link href="/book" className="btn btn--light">Book a session</Link>
            <Link href="/portfolio" className="btn btn--ghost">View the portfolio</Link>
          </div>
          <div className="hero__meta" aria-label="Highlights">
            <span>Studio &amp; on location</span>
            <span>Photography · Film</span>
            <span>Online booking with live availability</span>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="disciplines">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">What we make</span>
              <h2 id="disciplines">Two disciplines, <em>one eye</em>.</h2>
            </div>
            <Link href="/packages" className="link-arrow">Packages &amp; pricing</Link>
          </div>
          <div className="split" style={{ alignItems: 'start' }}>
            {[
              { num: '01', title: 'Photography', href: '/photography', image: 'photo-portrait', items: photo },
              { num: '02', title: 'Videography', href: '/videography', image: 'video-promo', items: video },
            ].map((d, i) => (
              <Reveal key={d.num} className="discipline" delay={i * 120}>
                <SampleImage imageKey={d.image} ratio="4x3" hover />
                <div className="cluster" style={{ alignItems: 'baseline', gap: 'var(--space-4)' }}>
                  <span className="discipline__num">{d.num}</span>
                  <h3 style={{ fontSize: 'var(--step-3)', margin: 0 }}>{d.title}</h3>
                </div>
                <ul className="service-list">
                  {d.items.map((s) => (
                    <li key={s.id}>
                      <Link href={`${d.href}#${s.slug}`}>
                        <span className="name">{s.name}</span>
                        <span className="price">{priceFrom(s)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--inverse" aria-labelledby="work">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Selected work</span>
              <h2 id="work">A curated <em>sample</em> portfolio</h2>
            </div>
            <span className="badge badge--demo" style={{ background: 'transparent', color: 'var(--inverse-muted)' }}>AI-generated sample imagery</span>
          </div>
          <div className="editorial-grid">
            {(work ?? []).slice(0, 5).map((p, i) => (
              <Link key={p.id} href={`/portfolio/${p.slug}`} className="work">
                <SampleImage imageKey={p.coverImage} alt={p.coverAlt} ratio="auto" sizes={i === 0 ? '(min-width: 900px) 58vw, 50vw' : '(min-width: 900px) 30vw, 50vw'} />
                <div className="work__caption">
                  <p>{p.category?.name}</p>
                  <h3>{p.title}</h3>
                </div>
              </Link>
            ))}
          </div>
          <p style={{ marginTop: 'var(--space-6)' }}><Link className="link-arrow" href="/portfolio">See all projects</Link></p>
        </div>
      </section>

      <section className="section" aria-labelledby="packages">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Packages</span>
              <h2 id="packages">Clear scopes, <em>itemised</em> prices</h2>
            </div>
            <span className="badge badge--demo">Sample prices</span>
          </div>
          <div className="grid grid--3">
            {featured.map((p, i) => (
              <div key={p.id} className={`package-card ${i === 1 ? 'package-card--featured' : ''}`}>
                <span className="eyebrow" style={{ margin: 0 }}>{p.service.name}</span>
                <h3 style={{ fontSize: 'var(--step-2)', margin: 0 }}>{p.name}</h3>
                <p className="price-tag" style={{ margin: 0 }}>{formatMoney(p.priceMinor)}</p>
                <p className="muted small" style={{ margin: 0 }}>{formatDuration(p.durationMin)} · plus applicable tax</p>
                <ul>{p.includes.map((x) => <li key={x}>{x}</li>)}</ul>
                <div style={{ marginTop: 'auto' }}>
                  <Link className="btn btn--sm" href={`/book?service=${p.service.slug}&package=${p.id}`}>Book {p.name}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="process">
        <div className="container">
          <span className="eyebrow">How booking works</span>
          <h2 id="process" style={{ marginBottom: 'var(--space-6)' }}>Reserved properly, <em>confirmed</em> honestly.</h2>
          <div className="process">
            <div><h3>Choose</h3><p className="muted small">Select a service or package and see the full price breakdown before you commit.</p></div>
            <div><h3>Reserve</h3><p className="muted small">Live availability is re-checked on our server, so a studio is never double-booked.</p></div>
            <div><h3>Confirm</h3><p className="muted small">Your booking is confirmed once the deposit is verified, or once the team approves a request.</p></div>
            <div><h3>Create</h3><p className="muted small">We plan the shoot with you and deliver your edited work.</p></div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="cta">
        <div className="container split">
          <p className="rule-quote" id="cta">Have a brief in mind? Let&rsquo;s give it <em>the right light</em>.</p>
          <div className="stack">
            <p className="lead">Book directly, or tell us about a larger production and we&rsquo;ll scope it with you.</p>
            <div className="cluster">
              <Link href="/book" className="btn">Book a session</Link>
              <Link href="/contact" className="btn btn--ghost">Start a conversation</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
