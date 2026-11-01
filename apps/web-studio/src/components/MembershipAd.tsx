import Link from 'next/link';
import { formatCalendarDate, formatMoney } from '@studio/ui';
import type { MembershipPlan, MembershipSummary } from '../lib/membership';

/** "Go Premium" advert shown to visitors who are not members. */
export function MembershipAd({ plans }: { plans: MembershipPlan[] }) {
  if (!plans.length) return null;
  const top = Math.max(...plans.map((p) => p.bookingDiscountBps)) / 100;
  return (
    <section className="st-section" aria-labelledby="premium-ad">
      <div className="container">
        <div className="mb-ad">
          <div className="mb-ad__copy">
            <p className="mb-eyebrow">Infinity Premium</p>
            <h2 id="premium-ad">Members pay {top}% less on every booking</h2>
            <p>Join Plus, Pro or Advanced and unlock member prices plus the premium member experience.</p>
            <Link href="/membership" className="mb-btn">See membership plans</Link>
            {plans.some((p) => p.isSample) && <p className="small" style={{ margin: 'var(--space-3) 0 0', opacity: 0.75 }}>Sample plans and prices for demonstration.</p>}
          </div>
          <ul className="mb-ad__plans">
            {plans.map((p) => (
              <li key={p.key} className={p.isFeatured ? 'is-featured' : undefined}>
                <Link href="/membership">
                  <span className="mb-ad__name">{p.name}{p.isFeatured && <small>Popular</small>}</span>
                  <span className="mb-ad__price">{formatMoney(p.priceMinor)}<small>/{p.periodDays === 30 ? 'mo' : `${p.periodDays}d`}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Greeting band at the top of the home page for members. */
export function MemberWelcome({ membership, firstName }: { membership: MembershipSummary; firstName: string }) {
  const ends = formatCalendarDate(membership.endsAt.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="mb-member" aria-labelledby="member-hello">
      <div className="container mb-member__row">
        <div>
          <p className="mb-eyebrow">{membership.plan.name} member</p>
          <h1 id="member-hello">Welcome back, {firstName}</h1>
          <p>Your member price, {membership.bookingDiscountBps / 100}% off, is applied to every booking. Active until {ends}.</p>
        </div>
        <Link href="/membership" className="btn btn--ghost">Manage membership</Link>
      </div>
    </section>
  );
}
