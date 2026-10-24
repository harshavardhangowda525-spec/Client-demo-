import Link from 'next/link';
import { formatMoney, Reveal, type PortfolioItem } from '@studio/ui';
import { getCatalog, SampleImage, serverApi } from '@studio/ui/server';
import { BRAND } from '../site';

export default async function Home() {
  const [catalog, gallery] = await Promise.all([getCatalog(BRAND), serverApi<PortfolioItem[]>(`/api/v1/sites/${BRAND}/portfolio`)]);
  const occasions = catalog.categories.filter((c) => c.slug !== 'planning');
  const consultation = catalog.services.find((s) => s.bookingMode === 'DIRECT');
  const imageFor = (slug: string) => catalog.services.find((s) => s.category?.slug === slug)?.imageKey ?? 'events-detail';
  return (
    <>
      <section className="ev-hero" aria-labelledby="hero-title">
        <div className="container">
          <span className="eyebrow">Event management · sample studio</span>
          <h1 id="hero-title">Gatherings, considered in <em>every</em> detail.</h1>
          <div className="ornament" aria-hidden="true">✦</div>
          <p className="lead">Corporate events, celebrations, workshops and launches, planned with care from first conversation to final toast.</p>
          <div className="cluster" style={{ justifyContent: 'center', marginTop: 'var(--space-5)' }}>
            <Link href="/enquire" className="btn">Plan your event</Link>
            <Link href="/book" className="btn btn--ghost">Book a consultation</Link>
          </div>
          <div className="ev-hero__images">
            <SampleImage imageKey="events-dinner" ratio="3x4" className="arch" />
            <SampleImage imageKey="events-hero" ratio="3x4" className="arch" priority />
            <SampleImage imageKey="events-celebration" ratio="3x4" className="arch" />
          </div>
          <p className="small muted" style={{ marginTop: 'var(--space-4)' }}>AI-generated sample imagery.</p>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="occasions">
        <div className="container">
          <div className="center" style={{ marginBottom: 'var(--space-7)' }}>
            <span className="eyebrow">Occasions</span>
            <h2 id="occasions">What we <em>bring together</em></h2>
          </div>
          <div className="grid grid--4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))' }}>
            {occasions.map((c, i) => (
              <Reveal key={c.id} delay={i * 80}>
                <Link href={`/categories#${c.slug}`} className="occasion">
                  <SampleImage imageKey={imageFor(c.slug)} ratio="3x4" className="arch" hover sizes="(min-width: 900px) 20vw, 50vw" />
                  <h3>{c.name}</h3>
                  <p className="small muted" style={{ margin: 0 }}>{c.description}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="paths">
        <div className="container">
          <div className="center" style={{ marginBottom: 'var(--space-7)' }}>
            <span className="eyebrow">Two ways to begin</span>
            <h2 id="paths">Enquire, or book <em>directly</em></h2>
          </div>
          <div className="two-paths">
            <div className="path path--accent">
              <span className="eyebrow">For full events</span>
              <h3 style={{ fontSize: 'var(--step-2)' }}>Enquiry &amp; tailored quotation</h3>
              <p className="muted">Tell us about the occasion. We review every enquiry and send an itemised proposal. Nothing is booked until you accept it and we confirm the date.</p>
              <ul className="inclusions"><li>Review by an event lead</li><li>Itemised, versioned quotation</li><li>Converted to a booking only on acceptance</li></ul>
              <div><Link className="btn" href="/enquire">Send an enquiry</Link></div>
            </div>
            <div className="path">
              <span className="eyebrow">Fixed price</span>
              <h3 style={{ fontSize: 'var(--step-2)' }}>{consultation?.name ?? 'Planning consultation'}</h3>
              <p className="muted">{consultation?.summary} Choose a time that suits you; availability is verified live.</p>
              {consultation && <p className="price-tag" style={{ margin: 0 }}>{formatMoney(consultation.basePriceMinor)} <span className="small muted">+ tax · sample price</span></p>}
              <div><Link className="btn btn--ghost" href="/book">Book a consultation</Link></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--inverse" aria-labelledby="gallery">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">Gallery</span><h2 id="gallery">Moments, <em>composed</em></h2></div>
            <Link className="link-arrow" href="/gallery">View gallery</Link>
          </div>
          <div className="grid grid--3">
            {(gallery ?? []).slice(0, 3).map((g) => (
              <figure key={g.id} style={{ margin: 0 }}>
                <SampleImage imageKey={g.coverImage} alt={g.coverAlt} ratio="4x3" hover />
                <figcaption className="figure-caption" style={{ color: 'var(--inverse-muted)' }}>{g.title} · sample</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
