'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatMoney } from '@studio/ui';
import { useSignIn } from './Session';

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
export interface MemberDetails {
  holderName: string;
  startsAt: string;
  endsAt: string;
  isSimulated: boolean;
  /** Server time when the page was rendered, so the server and browser show the same days left. */
  now: string;
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** The member's active plan, drawn as a membership card. */
function MemberCard({ plan, member, onRenew, busy, canPay }: { plan: PlanCardData; member: MemberDetails; onRenew: () => void; busy: boolean; canPay: boolean }) {
  const start = new Date(member.startsAt).getTime();
  const end = new Date(member.endsAt).getTime();
  const now = new Date(member.now).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
  const used = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  return (
    <section className="mb-current" aria-labelledby="mb-current-h">
      <div className={`mb-card mb-card--${plan.key}`}>
        <div className="mb-card__top">
          <span className="mb-card__brand"><span aria-hidden="true">∞</span> Infinity Premium</span>
          <span className="mb-card__status">Active</span>
        </div>
        <p id="mb-current-h" className="mb-card__plan">{plan.name}</p>
        <p className="mb-card__perk">{plan.bookingDiscountBps / 100}% off every booking</p>
        <div className="mb-card__bottom">
          <div><small>Member</small><span>{member.holderName}</span></div>
          <div><small>Valid until</small><span>{longDate(member.endsAt)}</span></div>
        </div>
        <span className="mb-card__chip" aria-hidden="true" />
      </div>
      <div className="mb-current__info stack">
        <p className="mb-eyebrow" style={{ margin: 0 }}>Your active plan</p>
        <h2 style={{ margin: 0 }}>{plan.name} · {formatMoney(plan.priceMinor)} / {period(plan.periodDays)}</h2>
        <div>
          <div className="mb-meter" role="progressbar" aria-label="Membership time used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)}>
            <span style={{ width: `${used * 100}%` }} />
          </div>
          <p className="small" style={{ margin: 'var(--space-2) 0 0' }}><strong>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</strong> · started {longDate(member.startsAt)}</p>
        </div>
        {plan.perks.length > 0 && <ul className="mb-plan__perks" style={{ margin: 0 }}>{plan.perks.map((perk) => <li key={perk}>{perk}</li>)}</ul>}
        {member.isSimulated && <p className="small muted" style={{ margin: 0 }}>Paid with a test payment (no real money moved).</p>}
        {canPay && (
          <div>
            <button type="button" className="mb-btn" onClick={onRenew} disabled={busy}>{busy ? 'Starting…' : `Renew ${plan.name} (+${plan.periodDays} days)`}</button>
            <p className="small muted" style={{ margin: 'var(--space-2) 0 0' }}>Renewing adds {plan.periodDays} days after {longDate(member.endsAt)}.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function MembershipPlans({ plans, signedIn, currentPlanKey, paymentsMode, member }: {
  plans: PlanCardData[];
  signedIn: boolean;
  currentPlanKey: string | null;
  paymentsMode: 'demo' | 'live' | 'disabled';
  /** Present for an active member: shows their plan as a card, then the other plans. */
  member?: MemberDetails | null;
}) {
  const router = useRouter();
  const openSignIn = useSignIn();
  const [busy, setBusy] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ membershipId: string; plan: PlanCardData } | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null);
  const currentPlan = plans.find((p) => p.key === currentPlanKey) ?? null;
  const otherPlans = plans.filter((p) => p.key !== currentPlanKey);

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
      {member && currentPlan && (
        <MemberCard plan={currentPlan} member={member} onRenew={() => buy(currentPlan)} busy={busy === currentPlan.key} canPay={paymentsMode !== 'disabled'} />
      )}
      {member && currentPlan && (
        <div className="mb-switch-head">
          <h2 id="mb-switch">{otherPlans.length ? 'Switch to another plan' : 'No other plans right now'}</h2>
          {otherPlans.length > 0 && <p className="small muted" style={{ margin: 0 }}>Switching starts the new plan today for a full {otherPlans[0]!.periodDays} days and replaces your {currentPlan.name} plan.</p>}
        </div>
      )}
      <div className="mb-plans">
        {(member && currentPlan ? otherPlans : plans).map((p) => {
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
                <button type="button" className="mb-btn" onClick={() => openSignIn()} aria-haspopup="dialog">Sign in to join</button>
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
