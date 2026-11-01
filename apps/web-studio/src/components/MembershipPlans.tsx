'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, formatMoney } from '@studio/ui';

export interface PlanCardData {
  key: string;
  name: string;
  tagline: string | null;
  priceMinor: number;
  periodDays: number;
  bookingDiscountBps: number;
  perks: string[];
  isFeatured: boolean;
}

type Checkout =
  | { provider: 'DEMO'; isSimulated: true; membershipId: string; amountMinor: number; currency: string }
  | { provider: 'RAZORPAY'; isSimulated: boolean; membershipId: string; providerOrderId: string; keyId: string; amountMinor: number; currency: string; merchantName: string; description: string; prefill: { name: string; email: string } };

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const period = (days: number) => (days === 30 ? 'month' : days === 365 ? 'year' : `${days} days`);

/**
 * Plan cards with a buy button. The price shown is the database price; the
 * server sets the amount, and the membership turns on only after the payment
 * is verified there.
 */
export function MembershipPlans({ plans, signedIn, currentPlanKey, paymentsMode }: {
  plans: PlanCardData[];
  signedIn: boolean;
  currentPlanKey: string | null;
  paymentsMode: 'demo' | 'live' | 'disabled';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ membershipId: string; plan: PlanCardData } | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null);

  function joined() {
    router.push('/membership/welcome');
    router.refresh();
  }

  async function buy(plan: PlanCardData) {
    setMessage(null);
    setBusy(plan.key);
    const res = await api<Checkout>('/api/v1/membership/checkout', { body: { planKey: plan.key } });
    if (!res.ok) {
      setBusy(null);
      setMessage({ tone: 'danger', text: res.error.message });
      return;
    }
    const c = res.data;
    if (c.provider === 'DEMO') {
      setBusy(null);
      setDemo({ membershipId: c.membershipId, plan });
      return;
    }
    if (!(await loadRazorpay()) || !window.Razorpay) {
      setBusy(null);
      setMessage({ tone: 'danger', text: 'The payment window could not be loaded. Please check your connection and try again.' });
      return;
    }
    const rzp = new window.Razorpay({
      key: c.keyId,
      amount: c.amountMinor,
      currency: c.currency,
      name: c.merchantName,
      description: c.description,
      order_id: c.providerOrderId,
      prefill: c.prefill,
      theme: { color: '#c9a227' },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        setMessage({ tone: 'info', text: 'Verifying your payment…' });
        const v = await api(`/api/v1/membership/${c.membershipId}/razorpay/confirm`, { body: resp });
        setBusy(null);
        if (v.ok) joined();
        else setMessage({ tone: 'danger', text: v.error.message });
      },
      modal: {
        ondismiss: async () => {
          // The window can close after a successful payment (e.g. UPI); check before giving up.
          const s = await api<{ status: string }>(`/api/v1/membership/${c.membershipId}/sync`, { body: {} });
          setBusy(null);
          if (s.ok && s.data.status === 'ACTIVE') joined();
          else setMessage({ tone: 'info', text: 'Payment not completed. You have not been charged for a membership.' });
        },
      },
    });
    rzp.on('payment.failed', () => setMessage({ tone: 'danger', text: 'The payment did not go through. You can try again.' }));
    rzp.open();
  }

  async function simulate(outcome: 'success' | 'failure') {
    if (!demo) return;
    setBusy(demo.plan.key);
    const res = await api(`/api/v1/membership/${demo.membershipId}/simulate`, { body: { outcome } });
    setBusy(null);
    setDemo(null);
    if (res.ok) joined();
    else setMessage({ tone: 'danger', text: res.error.message });
  }

  return (
    <div className="stack">
      {message && <div className={`alert alert--${message.tone}`} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</div>}
      <div className="mb-plans">
        {plans.map((p) => {
          const current = currentPlanKey === p.key;
          return (
            <article key={p.key} className={`mb-plan${p.isFeatured ? ' mb-plan--featured' : ''}`} aria-labelledby={`plan-${p.key}`}>
              {p.isFeatured && <span className="mb-plan__flag">Most popular</span>}
              <h3 id={`plan-${p.key}`} className="mb-plan__name">{p.name}</h3>
              {p.tagline && <p className="mb-plan__tagline">{p.tagline}</p>}
              <p className="mb-plan__price"><strong>{formatMoney(p.priceMinor)}</strong><span> / {period(p.periodDays)}</span></p>
              <p className="mb-plan__save">{p.bookingDiscountBps / 100}% off every booking</p>
              <ul className="mb-plan__perks">{p.perks.map((perk) => <li key={perk}>{perk}</li>)}</ul>
              {!signedIn ? (
                <Link className="mb-btn" href={`/account?next=${encodeURIComponent('/membership')}`}>Sign in to join</Link>
              ) : paymentsMode === 'disabled' ? (
                <span className="small muted">Online payment is not enabled yet.</span>
              ) : (
                <button type="button" className="mb-btn" onClick={() => buy(p)} disabled={!!busy}>
                  {busy === p.key ? 'Starting…' : current ? `Renew ${p.name}` : currentPlanKey ? `Switch to ${p.name}` : `Get ${p.name}`}
                </button>
              )}
              {current && <span className="mb-plan__current">Your current plan</span>}
            </article>
          );
        })}
      </div>

      {demo && (
        <div className="mb-demo" role="dialog" aria-modal="true" aria-labelledby="mb-demo-title">
          <div className="mb-demo__box stack">
            <p className="badge badge--demo" style={{ alignSelf: 'start' }}>Demo payment</p>
            <h2 id="mb-demo-title" style={{ margin: 0 }}>{demo.plan.name} membership · {formatMoney(demo.plan.priceMinor)}</h2>
            <p className="small" style={{ margin: 0 }}>No money moves in demo mode. Choose what the payment provider should report.</p>
            <div className="cluster">
              <button type="button" className="mb-btn" onClick={() => simulate('success')} disabled={!!busy}>Simulate successful payment</button>
              <button type="button" className="btn btn--ghost" onClick={() => simulate('failure')} disabled={!!busy}>Simulate failure</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
