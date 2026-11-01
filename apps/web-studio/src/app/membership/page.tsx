import type { Metadata } from 'next';
import Link from 'next/link';
import { formatCalendarDate } from '@studio/ui';
import { getMe, getSiteConfig } from '@studio/ui/server';
import { MembershipPlans } from '../../components/MembershipPlans';
import { getMembership, getPlans } from '../../lib/membership';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Infinity Premium membership' };

export default async function MembershipPage() {
  const [plans, me, membership, config] = await Promise.all([getPlans(), getMe(), getMembership(), getSiteConfig(BRAND)]);
  const isStaff = !!me?.user.isStaff;
  const ends = membership ? formatCalendarDate(membership.endsAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <>
      <section className="mb-hero">
        <div className="container">
          <p className="mb-eyebrow">Infinity Premium</p>
          <h1>Book more. Pay half.</h1>
          <p className="mb-hero__lead">Members pay 50% less on every studio session, shoot and package, and get the premium member experience across the site.</p>
          {membership && (
            <p className="mb-hero__status" role="status">You are a <strong>{membership.plan.name}</strong> member until {ends}.</p>
          )}
        </div>
      </section>
      <section className="st-section">
        <div className="container stack">
          {plans.some((p) => p.isSample) && <p className="badge badge--demo" style={{ alignSelf: 'start' }}>Sample plans: prices and perks are for demonstration</p>}
          {config.integrations.paymentsTestMode && <p className="small muted" style={{ margin: 0 }}>Payments run in Razorpay test mode. No real money moves.</p>}
          {isStaff ? (
            <div className="alert alert--info">You are signed in with a staff account. Memberships are for customer accounts.</div>
          ) : plans.length ? (
            <MembershipPlans plans={plans} signedIn={!!me} currentPlanKey={membership?.plan.key ?? null} paymentsMode={config.integrations.paymentsMode} />
          ) : (
            <div className="empty">No membership plans are on sale right now.</div>
          )}
          <div className="mb-how">
            <h2>How it works</h2>
            <ol>
              <li>Choose a plan and pay securely. Your membership starts as soon as the payment is confirmed.</li>
              <li>Book any service as usual. The member price is applied automatically at checkout, before fees and tax.</li>
              <li>Coupons still work on top of the member price.</li>
              <li>Buying the same plan again adds another {plans[0]?.periodDays ?? 30} days. Choosing a different plan switches to it straight away.</li>
            </ol>
            <p className="small muted">Questions? <Link href="/contact">Contact the team</Link>.</p>
          </div>
        </div>
      </section>
    </>
  );
}
