import Link from 'next/link';
import { formatCalendarDate, formatMoney } from '@studio/ui';
import { SampleImage } from '@studio/ui/server';
import type { StudioServiceCard } from '../lib/types';
import { SaveButton } from './SaveButton';

export function priceLabel(s: Pick<StudioServiceCard, 'fromPriceMinor' | 'pricingModel' | 'hourlyRateMinor' | 'bookingMode'>) {
  if (s.fromPriceMinor == null) return 'Custom quote';
  if (s.pricingModel === 'HOURLY') return `${formatMoney(s.hourlyRateMinor)} / hour`;
  return `From ${formatMoney(s.fromPriceMinor)}`;
}

function nextLabel(n: NonNullable<StudioServiceCard['nextAvailable']>, today: string) {
  const day = n.date === today ? 'Today' : formatCalendarDate(n.date, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${n.startTime}`;
}

/** Poster-style card used in rails and grids. Availability is the real next free slot, or nothing. */
export function ServiceCard({ s, today, priority }: { s: StudioServiceCard; today: string; priority?: boolean }) {
  const badge = s.categories[0]?.name;
  return (
    <article className="st-card">
      <div style={{ position: 'relative' }}>
        <Link href={`/service/${s.slug}`} tabIndex={-1} aria-hidden="true">
          <SampleImage imageKey={s.imageKey} ratio="3x4" sizes="(min-width: 1000px) 18vw, (min-width: 640px) 30vw, 46vw" priority={priority} alt="" />
        </Link>
        {badge && <span className="st-card__badge">{badge}</span>}
        <SaveButton serviceId={s.id} serviceName={s.name} />
      </div>
      <h3 className="st-card__title"><Link href={`/service/${s.slug}`} style={{ textDecoration: 'none' }}>{s.name}</Link></h3>
      <p className="st-card__meta">{s.summary}</p>
      <p className="st-card__price">{priceLabel(s)}</p>
      {s.bookingMode === 'ENQUIRY' ? (
        <span className="st-avail st-avail--request">Quotation on request</span>
      ) : s.nextAvailable ? (
        <span className="st-avail"><span aria-hidden="true">●</span> Next free: {nextLabel(s.nextAvailable, today)}</span>
      ) : s.nextAvailable === null ? (
        <span className="st-avail st-avail--request">No free slots in the next 14 days</span>
      ) : null}
    </article>
  );
}
