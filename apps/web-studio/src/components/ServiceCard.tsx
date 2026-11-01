import Link from 'next/link';
import { formatCalendarDate, formatMoney } from '@studio/ui';
import { SampleImage } from '@studio/ui/server';
import { getMembership, memberPrice } from '../lib/membership';
import type { StudioServiceCard } from '../lib/types';
import { SaveButton } from './SaveButton';

type Priced = Pick<StudioServiceCard, 'fromPriceMinor' | 'pricingModel' | 'hourlyRateMinor' | 'bookingMode'>;

/** List price; with `memberBps`, the member price instead. */
export function priceLabel(s: Priced, memberBps?: number) {
  if (s.fromPriceMinor == null) return 'Custom quote';
  const m = (minor: number) => formatMoney(memberBps ? memberPrice(minor, memberBps) : minor);
  if (s.pricingModel === 'HOURLY') return `${m(s.hourlyRateMinor)} / hour`;
  return `From ${m(s.fromPriceMinor)}`;
}

/** Price with the list price struck through for members. */
export function PriceTag({ s, memberBps }: { s: Priced; memberBps?: number | null }) {
  if (!memberBps || s.fromPriceMinor == null) return <>{priceLabel(s)}</>;
  return (
    <span className="mb-price">
      <s className="mb-price__was"><span className="visually-hidden">Was </span>{priceLabel(s).replace(/^From /, '')}</s>{' '}
      <span className="mb-price__now"><span className="visually-hidden">Member price </span>{priceLabel(s, memberBps)}</span>
    </span>
  );
}

function nextLabel(n: NonNullable<StudioServiceCard['nextAvailable']>, today: string) {
  const day = n.date === today ? 'Today' : formatCalendarDate(n.date, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${n.startTime}`;
}

/**
 * Poster card (BookMyShow layout). The strip under the image shows the real
 * average rating when published reviews exist, otherwise the price; it never
 * shows an invented score.
 */
export async function ServiceCard({ s, today, priority }: { s: StudioServiceCard; today: string; priority?: boolean }) {
  const memberBps = (await getMembership())?.bookingDiscountBps ?? null;
  const badge = s.categories[0]?.name;
  const r = s.rating;
  return (
    <article className="st-card">
      <div className="st-card__poster">
        <Link href={`/service/${s.slug}`} tabIndex={-1} aria-hidden="true">
          <SampleImage imageKey={s.imageKey} ratio="3x4" sizes="(min-width: 1000px) 18vw, (min-width: 640px) 30vw, 46vw" priority={priority} alt="" />
        </Link>
        {badge && <span className="st-card__badge">{badge}</span>}
        <SaveButton serviceId={s.id} serviceName={s.name} />
        <div className="st-card__strip">
          {r ? (
            <span><span className="star" aria-hidden="true">★</span> {r.average.toFixed(1)}/5 <span className="muted">· {r.count} {r.count === 1 ? 'review' : 'reviews'}</span></span>
          ) : (
            <span><PriceTag s={s} memberBps={memberBps} /></span>
          )}
        </div>
      </div>
      <h3 className="st-card__title"><Link href={`/service/${s.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>{s.name}</Link></h3>
      <p className="st-card__meta">{s.categories.map((c) => c.name).join('/') || s.summary}</p>
      {r && <p className="st-card__price"><PriceTag s={s} memberBps={memberBps} /></p>}
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
