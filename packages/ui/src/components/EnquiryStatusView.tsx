'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, recallAccessToken, rememberAccessToken } from '../lib/api';
import { formatCalendarDate, formatDateTime, formatMoney } from '../lib/format';
import { PriceBreakdown } from './PriceBreakdown';
import { TextField } from './BookingFlow';

interface EnquiryDto {
  reference: string;
  status: string;
  eventType: string;
  category: string | null;
  preferredDate: string;
  alternateDate: string | null;
  location: { name: string; city: string } | null;
  venueDetails: string | null;
  expectedAttendance: number;
  services: string[];
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  contact: { name: string; email: string; phone: string | null };
  booking: { reference: string; status: string } | null;
  quotations: {
    id: string; reference: string; version: number; status: string; currency: string;
    lines: { description: string; quantity: number; unitPriceMinor: number; totalMinor: number }[];
    subtotalMinor: number; discountMinor: number; feesMinor: number; taxMinor: number; totalMinor: number; depositMinor: number;
    validUntil: string; terms: string | null; customerMessage: string | null;
  }[];
}

const STATUS_TEXT: Record<string, string> = {
  SUBMITTED: 'Received. The team will review it shortly.',
  UNDER_REVIEW: 'The team is preparing your proposal.',
  QUOTED: 'A proposal is ready for you to review below.',
  ACCEPTED: 'You accepted the proposal. The team will confirm the date and create your booking.',
  DECLINED: 'This enquiry was declined.',
  CONVERTED: 'Your enquiry has been converted into a booking.',
  CLOSED: 'This enquiry is closed.',
};

export function EnquiryStatusView({ initialRef, initialToken, signedIn }: { initialRef?: string; initialToken?: string; signedIn: boolean }) {
  const [ref, setRef] = useState(initialRef ?? '');
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<EnquiryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(reference: string, t: string | null) {
    setLoading(true);
    const res = await api<EnquiryDto>(`/api/v1/enquiries/${encodeURIComponent(reference)}`, { headers: t ? { 'X-Booking-Token': t } : {} });
    setLoading(false);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else setError(res.status === 404 ? 'We could not open this enquiry from this browser. Use the link in your confirmation message or sign in with the account used for the enquiry.' : res.error.message);
  }

  useEffect(() => {
    if (!initialRef) return;
    let t = initialToken ?? null;
    if (t) {
      rememberAccessToken(initialRef, t);
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState(null, '', url.toString());
    } else t = recallAccessToken(initialRef);
    setToken(t);
    if (t || signedIn) load(initialRef, t);
  }, [initialRef, initialToken, signedIn]);

  async function respond(quotationId: string, decision: 'ACCEPT' | 'DECLINE') {
    if (!data) return;
    setBusy(true);
    const res = await api(`/api/v1/enquiries/${data.reference}/quotations/${quotationId}/respond`, { body: { decision }, headers: token ? { 'X-Booking-Token': token } : {} });
    setBusy(false);
    if (res.ok) await load(data.reference, token);
    else setError(res.error.message);
  }

  if (loading) return <p className="muted"><span className="spinner" aria-hidden="true" /> Loading…</p>;

  if (!data) {
    return (
      <form className="form card" onSubmit={(e: FormEvent) => { e.preventDefault(); const t = recallAccessToken(ref); setToken(t); load(ref.toUpperCase(), t); }}>
        {error && <div className="alert alert--warning" role="status">{error}</div>}
        <TextField id="enq-ref" label="Enquiry reference" value={ref} onChange={(v) => setRef(v.toUpperCase())} hint="For example EQ-7K3Q9XMR" />
        <div><button className="btn" type="submit" disabled={!ref}>Open enquiry</button></div>
      </form>
    );
  }

  const open = data.quotations.find((q) => q.status === 'SENT');
  return (
    <div className="stack-lg">
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
      <div>
        <p className="eyebrow">Enquiry {data.reference}</p>
        <h2>{data.eventType}</h2>
        <p><span className="badge">{data.status.replace('_', ' ').toLowerCase()}</span></p>
        <p className="muted">{STATUS_TEXT[data.status]}</p>
        {data.booking && <p><a className="btn" href={`/booking-status?ref=${data.booking.reference}`}>View booking {data.booking.reference}</a></p>}
      </div>
      <dl className="dl">
        <dt>Preferred date</dt><dd>{formatCalendarDate(data.preferredDate)}</dd>
        {data.alternateDate && (<><dt>Alternate date</dt><dd>{formatCalendarDate(data.alternateDate)}</dd></>)}
        <dt>Guests</dt><dd>{data.expectedAttendance}</dd>
        <dt>Venue</dt><dd>{data.location ? `${data.location.name}, ${data.location.city}` : data.venueDetails ?? 'To be decided'}</dd>
        {data.services.length > 0 && (<><dt>Services</dt><dd>{data.services.join(', ')}</dd></>)}
        {(data.budgetMinMinor != null || data.budgetMaxMinor != null) && (<><dt>Budget</dt><dd>{data.budgetMinMinor != null ? formatMoney(data.budgetMinMinor) : '…'} to {data.budgetMaxMinor != null ? formatMoney(data.budgetMaxMinor) : '…'}</dd></>)}
      </dl>
      {data.quotations.map((q) => (
        <section key={q.id} className="card stack" aria-labelledby={`q-${q.id}`}>
          <p className="eyebrow">Proposal {q.reference} · version {q.version}</p>
          <h3 id={`q-${q.id}`}>{q.status === 'SENT' ? 'Your proposal' : `Proposal (${q.status.toLowerCase()})`}</h3>
          {q.customerMessage && <p>{q.customerMessage}</p>}
          <PriceBreakdown lines={q.lines.map((l) => ({ ...l, kind: 'QUOTE_LINE', description: `${l.description}${l.quantity !== 1 ? ` (${l.quantity} × ${formatMoney(l.unitPriceMinor, q.currency)})` : ''}` }))} totalMinor={q.totalMinor} depositMinor={q.depositMinor} currency={q.currency} />
          <p className="small muted">Valid until {formatDateTime(q.validUntil, 'Asia/Kolkata', { hour: undefined, minute: undefined })}. Tax is included in the total shown.</p>
          {q.terms && <p className="small">{q.terms}</p>}
          {open?.id === q.id && (
            <div className="cluster">
              <button className="btn" type="button" disabled={busy} onClick={() => respond(q.id, 'ACCEPT')}>Accept proposal</button>
              <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => respond(q.id, 'DECLINE')}>Decline</button>
            </div>
          )}
          {open?.id === q.id && <p className="small muted">Accepting does not take payment. The team will confirm availability and create your booking, then request the deposit.</p>}
        </section>
      ))}
    </div>
  );
}
