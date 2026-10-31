'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { profileUpdateSchema } from '@studio/core/schemas';
import { api } from '../lib/api';
import { formatDateTime, formatMoney, formatCalendarDate } from '../lib/format';
import type { Brand, Me } from '../lib/types';
import { TextField } from './BookingFlow';
import { StatusBadge } from './BookingStatusView';

export interface AccountBooking {
  reference: string; brand: Brand; service: string; location: string; startsAt: string; timezone: string;
  status: string; statusLabel: string; paymentStatusLabel: string; totalMinor: number; currency: string; isDemo: boolean;
}
export interface AccountEnquiry { reference: string; eventType: string; preferredDate: string; status: string }
export interface AccountPayment { bookingReference: string; type: string; status: string; amountMinor: number; currency: string; isSimulated: boolean; at: string }

/** Plain-language reason for a failed Google sign-in, with the code for support. */
export function googleErrorMessage(code: string): string {
  const reasons: Record<string, string> = {
    access_denied: 'Google sign-in was cancelled, or this Google account is not allowed to use the app yet (while the app is in testing, only listed test users can sign in).',
    unable_to_link_account: 'This email belongs to a staff account. Staff sign in with a password on the admin panel.',
    account_not_linked: 'An account with this email already exists and could not be linked to Google. Sign in with email and password instead.',
    state_mismatch: 'The sign-in session expired or was started in another tab or browser. Please try again.',
    state_not_found: 'The sign-in session expired or was started in another tab or browser. Please try again.',
    state_invalid: 'The sign-in session expired or was started in another tab or browser. Please try again.',
    invalid_code: 'Google did not accept the website\'s sign-in keys. The site owner should check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
    unable_to_get_user_info: 'Google did not share the account details needed to sign in.',
    email_not_found: 'Google did not share an email address for this account.',
  };
  return `${reasons[code] ?? 'Google sign-in did not complete. Please try again or use email and password.'} (code: ${code})`;
}

export function AuthPanel({ next, emailDelivery, adminUrl, demoAccount = { email: 'customer@demo.example', password: 'DemoCustomer!2026', label: 'Demo customer' }, allowRegister = true, googleSignIn = false, oauthError }: {
  next?: string;
  emailDelivery: boolean;
  adminUrl?: string;
  demoAccount?: { email: string; password: string; label: string };
  allowRegister?: boolean;
  /** Show "Continue with Google" (only on the site Google redirects back to). */
  googleSignIn?: boolean;
  /** Error code returned by the sign-in provider, if the last attempt failed. */
  oauthError?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthError ? googleErrorMessage(oauthError) : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  async function google() {
    setError(null);
    setBusy(true);
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
    const res = await api<{ url?: string }>('/api/auth/sign-in/social', {
      body: { provider: 'google', callbackURL: `${window.location.origin}${safeNext}`, errorCallbackURL: `${window.location.origin}/account?signin=google` },
    });
    if (res.ok && res.data.url) {
      window.location.href = res.data.url;
      return;
    }
    setBusy(false);
    setError('Google sign-in is not available right now. Please use email and password.');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    let res;
    if (mode === 'signin') res = await api('/api/auth/sign-in/email', { body: { email, password } });
    else if (mode === 'register') {
      if (password.length < 10) {
        setBusy(false);
        setError('Use at least 10 characters for your password.');
        return;
      }
      res = await api('/api/auth/sign-up/email', { body: { name, email, password } });
    } else res = await api('/api/auth/request-password-reset', { body: { email, redirectTo: `${window.location.origin}/account/reset-password` } });
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 401 ? 'Email or password is incorrect.' : (res.error as { message?: string }).message ?? 'Something went wrong.');
      return;
    }
    if (mode === 'forgot') {
      setInfo(
        emailDelivery
          ? 'If an account exists for that email, a reset link is on its way.'
          : 'If an account exists for that email, a reset link has been generated. Email delivery is not configured in this demo, so the link appears in the admin panel’s development notification preview (simulation).',
      );
      return;
    }
    if (next && next.startsWith('/') && !next.startsWith('//')) router.push(next);
    router.refresh();
  }

  const tabs = ([['signin', 'Sign in'], ['register', 'Create account'], ['forgot', 'Forgot password']] as [typeof mode, string][]).filter(([m]) => allowRegister || m !== 'register');
  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="filters" role="tablist" aria-label="Account options">
        {tabs.map(([m, label]) => (
          <button key={m} type="button" role="tab" className="chip" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); setInfo(null); }}>
            {label}
          </button>
        ))}
      </div>
      {googleSignIn && mode !== 'forgot' && (
        <div className="stack" style={{ gap: 'var(--space-3)', margin: 'var(--space-4) 0' }}>
          <button type="button" className="btn btn--ghost btn--block" onClick={google} disabled={busy} style={{ display: 'inline-flex', gap: 10, justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.4 2.2-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>
            Continue with Google
          </button>
          <p className="small muted center" style={{ margin: 0 }}>or use your email</p>
        </div>
      )}
      <form className="form" onSubmit={submit} noValidate>
        {mode === 'register' && <TextField id="a-name" label="Full name" autoComplete="name" value={name} onChange={setName} required />}
        <TextField id="a-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required />
        {mode !== 'forgot' && (
          <TextField id="a-password" label="Password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} required hint={mode === 'register' ? 'At least 10 characters.' : undefined} />
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        {info && <div className="alert alert--info" role="status">{info}</div>}
        {mode === 'register' && !emailDelivery && (
          <p className="small muted">Email verification runs in simulation mode in this demo: the verification link is stored as a preview, not emailed.</p>
        )}
        <div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
          </button>
        </div>
      </form>
      <hr />
      <p className="small muted" style={{ margin: 0 }}>
        {demoAccount.label}: <span className="mono">{demoAccount.email}</span> / <span className="mono">{demoAccount.password}</span>
        {adminUrl && <> · Staff use the <a href={adminUrl}>admin panel</a>.</>}
      </p>
    </div>
  );
}

export function AccountDashboard({ me, bookings, enquiries, payments, brand, brandSites, adminUrl, homeBrands }: {
  homeBrands?: Brand[];
  me: Me;
  bookings: AccountBooking[];
  enquiries: AccountEnquiry[];
  payments: AccountPayment[];
  brand: Brand;
  brandSites: Record<Brand, string>;
  adminUrl: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState({ fullName: me.profile.fullName, phone: me.profile.phone ?? '', company: me.profile.company ?? '' });
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = profileUpdateSchema.safeParse(profile);
    if (!parsed.success) {
      setMsg({ tone: 'danger', text: parsed.error.issues[0]?.message ?? 'Check your details.' });
      return;
    }
    setBusy(true);
    const res = await api('/api/v1/me/profile', { method: 'PATCH', body: profile });
    setBusy(false);
    setMsg(res.ok ? { tone: 'success', text: 'Profile saved.' } : { tone: 'danger', text: res.error.message });
    if (res.ok) router.refresh();
  }

  async function signOut() {
    await api('/api/auth/sign-out', { body: {} });
    router.push('/account');
    router.refresh();
  }

  const local = homeBrands ?? [brand];
  const linkFor = (b: AccountBooking) => (local.includes(b.brand) ? `/booking-status?ref=${b.reference}` : `${brandSites[b.brand]}/booking-status?ref=${b.reference}`);
  const nowIso = new Date().toISOString();
  const upcoming = bookings.filter((b) => b.startsAt >= nowIso && !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(b.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="stack-lg">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <p style={{ margin: 0 }}>Signed in as <strong>{me.user.email}</strong></p>
        <div className="cluster">
          {me.user.isStaff && <a className="btn btn--ghost btn--sm" href={adminUrl}>Open admin panel</a>}
          <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {[
        { id: 'up-h', title: 'Upcoming bookings', rows: upcoming, empty: <>No upcoming bookings. <a href="/book">Make a booking</a>.</> },
        { id: 'past-h', title: 'Past and cancelled bookings', rows: past, empty: <>Nothing here yet.</> },
      ].map((group) => (
        <section key={group.id} aria-labelledby={group.id}>
          <h2 id={group.id} style={{ fontSize: 'var(--step-2)' }}>{group.title}</h2>
          {group.rows.length === 0 ? (
            <div className="empty">{group.empty}</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Reference</th><th>Service</th><th>When</th><th>Status</th><th>Total</th></tr></thead>
                <tbody>
                  {group.rows.map((b) => (
                    <tr key={b.reference}>
                      <td><a href={linkFor(b)} className="mono">{b.reference}</a>{b.isDemo && <> <span className="badge badge--demo">Demo</span></>}</td>
                      <td>{b.service}<div className="small muted">{b.location}</div></td>
                      <td>{formatDateTime(b.startsAt, b.timezone)}</td>
                      <td><StatusBadge status={b.status} label={b.statusLabel} /><div className="small muted">{b.paymentStatusLabel}</div></td>
                      <td className="price">{formatMoney(b.totalMinor, b.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {enquiries.length > 0 && (
        <section aria-labelledby="e-h">
          <h2 id="e-h" style={{ fontSize: 'var(--step-2)' }}>Event enquiries</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Reference</th><th>Event</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {enquiries.map((e) => (
                  <tr key={e.reference}>
                    <td><a className="mono" href={`${brandSites.EVENTS}/enquiry-status?ref=${e.reference}`}>{e.reference}</a></td>
                    <td>{e.eventType}</td>
                    <td>{formatCalendarDate(e.preferredDate, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{e.status.replace('_', ' ').toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="p-h">
        <h2 id="p-h" style={{ fontSize: 'var(--step-2)' }}>Payment history</h2>
        {payments.length === 0 ? (
          <p className="muted">No payments recorded.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Booking</th><th>Type</th><th>Status</th><th>Amount</th></tr></thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td>{formatDateTime(p.at, 'Asia/Kolkata')}</td>
                    <td className="mono">{p.bookingReference}</td>
                    <td>{p.type === 'CHARGE' ? 'Payment' : 'Refund'} {p.isSimulated && <span className="badge badge--demo">Simulated</span>}</td>
                    <td>{p.status.toLowerCase()}</td>
                    <td className="price">{formatMoney(p.amountMinor, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="pr-h" className="card" style={{ maxWidth: 640 }}>
        <h2 id="pr-h" style={{ fontSize: 'var(--step-2)' }}>Profile</h2>
        <form className="form" onSubmit={save} noValidate>
          <TextField id="p-name" label="Full name" value={profile.fullName} onChange={(v) => setProfile({ ...profile, fullName: v })} required />
          <div className="form-row form-row--2">
            <TextField id="p-phone" label="Phone" type="tel" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
            <TextField id="p-company" label="Company" value={profile.company} onChange={(v) => setProfile({ ...profile, company: v })} />
          </div>
          {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
          <div><button className="btn" type="submit" disabled={busy}>Save profile</button></div>
        </form>
      </section>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setMsg({ tone: 'danger', text: 'Use at least 10 characters.' });
    if (password !== confirm) return setMsg({ tone: 'danger', text: 'Passwords do not match.' });
    const res = await api('/api/auth/reset-password', { body: { newPassword: password, token } });
    if (res.ok) {
      setDone(true);
      setMsg({ tone: 'success', text: 'Password updated. You can now sign in.' });
    } else setMsg({ tone: 'danger', text: 'This reset link is invalid or has expired. Request a new one.' });
  }

  if (!token) return <div className="alert alert--warning">This page needs the reset link from your email.</div>;
  return (
    <form className="form card" style={{ maxWidth: 520 }} onSubmit={submit} noValidate>
      <TextField id="np" label="New password" type="password" autoComplete="new-password" value={password} onChange={setPassword} required />
      <TextField id="np2" label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} required />
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      <div>{done ? <a className="btn" href="/account">Sign in</a> : <button className="btn" type="submit">Set new password</button>}</div>
    </form>
  );
}
