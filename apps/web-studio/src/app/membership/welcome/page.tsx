import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatCalendarDate } from '@studio/ui';
import { getMe } from '@studio/ui/server';
import { getMembership } from '../../../lib/membership';

export const metadata: Metadata = { title: 'Welcome to Premium' };

export default async function WelcomePage() {
  const [me, membership] = await Promise.all([getMe(), getMembership()]);
  if (!membership) redirect('/membership');
  const name = me?.profile.fullName.split(' ')[0] ?? 'there';
  const ends = formatCalendarDate(membership.endsAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section className="mb-hero mb-hero--welcome">
      <div className="container stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span className="mb-crest" aria-hidden="true">∞</span>
        <p className="mb-eyebrow">Infinity Premium · {membership.plan.name}</p>
        <h1>Welcome to Premium, {name}.</h1>
        <p className="mb-hero__lead">Your membership is active until {ends}. Every booking now shows your member price: {membership.bookingDiscountBps / 100}% off.</p>
        {membership.isSimulated && <p className="small" style={{ margin: 0, opacity: 0.8 }}>Paid with a test payment (no real money moved).</p>}
        <div className="cluster" style={{ justifyContent: 'center' }}>
          <Link href="/" className="mb-btn">Explore member prices</Link>
          <Link href="/account" className="btn btn--ghost">My account</Link>
        </div>
      </div>
    </section>
  );
}
