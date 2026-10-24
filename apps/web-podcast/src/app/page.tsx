import Link from 'next/link';
import { formatDuration, priceFrom, Reveal, type PortfolioItem } from '@studio/ui';
import { getCatalog, getLocations, SampleImage, serverApi } from '@studio/ui/server';
import { Waveform } from '../components/Waveform';
import { BRAND } from '../site';

export default async function Home() {
  const [catalog, locations, gallery] = await Promise.all([getCatalog(BRAND), getLocations(BRAND), serverApi<PortfolioItem[]>(`/api/v1/sites/${BRAND}/portfolio`)]);
  const rooms = locations.flatMap((l) => l.resources.map((r) => ({ ...r, location: l })));
  return (
    <>
      <section className="pod-hero" aria-labelledby="hero-title">
        <div className="container split">
          <div>
            <span className="rec">Studios open for booking · demo</span>
            <h1 id="hero-title">Record the conversation <span>clearly</span>.</h1>
            <p className="lead">Treated rooms, video sets and engineers for podcasts and interviews. Check live availability and book a session in minutes.</p>
            <div className="cluster" style={{ marginTop: 'var(--space-5)' }}>
              <Link href="/book" className="btn">Book studio time</Link>
              <Link href="/availability" className="btn btn--ghost">Check availability</Link>
            </div>
            <Waveform />
          </div>
          <div className="frame" data-label="CAM A · sample image">
            <SampleImage imageKey="podcast-hero" ratio="4x3" priority sizes="(min-width: 900px) 50vw, 100vw" />
          </div>
        </div>
      </section>

      <section className="section--tight section" aria-label="At a glance">
        <div className="container">
          <div className="kpi-strip">
            <div><span className="mono">Locations</span><p>{locations.length} studio locations (demo)</p></div>
            <div><span className="mono">Rooms &amp; sets</span><p>{rooms.length} bookable spaces</p></div>
            <div><span className="mono">Session types</span><p>{catalog.services.length} services</p></div>
            <div><span className="mono">Booking</span><p>Live, conflict-free scheduling</p></div>
          </div>
          <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>Counts are read live from the booking system&rsquo;s sample data.</p>
        </div>
      </section>

      <section className="section" aria-labelledby="sessions">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">Sessions</span><h2 id="sessions">Choose how you record</h2></div>
            <Link href="/services" className="link-arrow">All services</Link>
          </div>
          <div className="grid grid--3">
            {catalog.services.map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <Link className="spec" href={`/book?service=${s.slug}`}>
                  <SampleImage imageKey={s.imageKey} ratio="16x9" sizes="(min-width: 900px) 33vw, 100vw" />
                  <div className="spec__body">
                    <h3>{s.name}</h3>
                    <p className="small muted" style={{ margin: 0 }}>{s.summary}</p>
                    <div className="spec__row"><span>RATE</span><strong>{priceFrom(s)}</strong></div>
                    <div className="spec__row"><span>LENGTH</span><strong>{formatDuration(s.minDurationMin)}{s.maxDurationMin !== s.minDurationMin ? `–${formatDuration(s.maxDurationMin)}` : ''}</strong></div>
                    <div className="spec__row"><span>MODE</span><strong>{s.bookingMode === 'REQUEST' ? 'Reviewed request' : 'Instant reservation'}</strong></div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--surface" aria-labelledby="rooms">
        <div className="container split">
          <div className="stack">
            <span className="eyebrow">Studios</span>
            <h2 id="rooms">Rooms that never double-book</h2>
            <p className="muted">Every room and set is an exclusive resource. When you reserve, our server re-checks the calendar, including turnaround time between sessions, so two shows can never hold the same room.</p>
            <ul className="small" style={{ fontFamily: 'var(--font-mono)' }}>
              {rooms.map((r) => <li key={r.id}>{r.name} · {r.location.city}{r.capacity ? ` · up to ${r.capacity} people` : ''}</li>)}
            </ul>
            <div className="cluster"><Link className="btn" href="/availability">See the calendar</Link><Link className="btn btn--ghost" href="/facilities">Facilities</Link></div>
          </div>
          <div className="frame" data-label="ROOM · sample image"><SampleImage imageKey="podcast-multicam" ratio="4x3" /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="gallery">
        <div className="container">
          <div className="section-head">
            <div><span className="eyebrow">Gallery</span><h2 id="gallery">Inside the studio</h2></div>
            <span className="badge badge--demo">AI-generated sample imagery</span>
          </div>
          <div className="grid grid--4">
            {(gallery ?? []).slice(0, 4).map((g) => (
              <Link key={g.id} href="/gallery" style={{ textDecoration: 'none' }}>
                <SampleImage imageKey={g.coverImage} alt={g.coverAlt} ratio="1x1" hover sizes="(min-width: 900px) 25vw, 50vw" />
                <p className="small" style={{ marginTop: 'var(--space-2)' }}>{g.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--inverse" aria-labelledby="cta">
        <div className="container center stack">
          <span className="eyebrow">Ready when you are</span>
          <h2 id="cta">Pick a slot. Hit record.</h2>
          <p className="lead" style={{ marginInline: 'auto' }}>See what&rsquo;s free across both studios, with an itemised price before you pay anything.</p>
          <div className="cluster" style={{ justifyContent: 'center' }}><Link className="btn" href="/book">Book a session</Link></div>
        </div>
      </section>
    </>
  );
}
