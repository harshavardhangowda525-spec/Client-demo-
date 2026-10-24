import Link from 'next/link';
import { formatDuration, formatMoney, priceFrom, Reveal, type PublicService } from '@studio/ui';
import { SampleImage } from '@studio/ui/server';

export function ServiceSection({ service, index }: { service: PublicService; index: number }) {
  const reverse = index % 2 === 1;
  return (
    <section id={service.slug} className="section" aria-labelledby={`${service.slug}-h`} style={{ borderTop: index ? '1px solid var(--border)' : undefined, scrollMarginTop: 80 }}>
      <div className="container split" style={{ alignItems: 'start' }}>
        <Reveal className={reverse ? 'split-media-right' : ''}>
          <SampleImage imageKey={service.imageKey} ratio="4x3" tag />
        </Reveal>
        <div className="stack" style={reverse ? { order: -1 } : undefined}>
          <span className="eyebrow">{String(index + 1).padStart(2, '0')} · {service.bookingMode === 'REQUEST' ? 'By request' : 'Book online'}</span>
          <h2 id={`${service.slug}-h`}>{service.name}</h2>
          <p className="lead">{service.summary}</p>
          <p>{service.description}</p>
          <dl className="dl">
            <dt>Price</dt>
            <dd>{priceFrom(service)} <span className="muted small">+ tax</span></dd>
            <dt>Duration</dt>
            <dd>{service.minDurationMin === service.maxDurationMin ? formatDuration(service.minDurationMin) : `${formatDuration(service.minDurationMin)} to ${formatDuration(service.maxDurationMin)}`}</dd>
            {service.addOns.length > 0 && (<><dt>Add-ons</dt><dd>{service.addOns.map((a) => a.name).join(', ')}</dd></>)}
          </dl>
          {service.packages.length > 0 && (
            <div className="grid grid--2" style={{ gap: 'var(--space-3)' }}>
              {service.packages.map((p) => (
                <div key={p.id} className="card" style={{ padding: 'var(--space-4)' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{p.name} <span className="price muted" style={{ fontWeight: 400 }}>· {formatMoney(p.priceMinor)}</span></p>
                  <p className="small muted" style={{ margin: 0 }}>{formatDuration(p.durationMin)} · {p.includes.join(' · ')}</p>
                </div>
              ))}
            </div>
          )}
          <div className="cluster">
            <Link className="btn" href={`/book?service=${service.slug}`}>{service.bookingMode === 'REQUEST' ? 'Request a date' : 'Book this service'}</Link>
            {service.isDemo && <span className="badge badge--demo">Sample service</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
