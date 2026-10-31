'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, formatDateTime, formatMoney, formatTime, recallAccessToken } from '@studio/ui';

interface TicketData {
  reference: string;
  code: string;
  status: string;
  service: string;
  package: string | null;
  location: { name: string; addressLine1: string; city: string };
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendees: number | null;
  contactName: string;
  balanceDueMinor: number;
  currency: string;
  checkedInAt: string | null;
  isDemo: boolean;
}

/** Ticket stub with a QR code that staff scan at the studio. The code is signed by the server. */
export function Ticket({ reference, token: urlToken }: { reference: string; token?: string }) {
  const [t, setT] = useState<TicketData | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = urlToken ?? recallAccessToken(reference);
    api<TicketData>(`/api/v1/bookings/${encodeURIComponent(reference)}/ticket`, { headers: token ? { 'X-Booking-Token': token } : {} }).then(async (r) => {
      if (!r.ok) {
        setError(r.status === 409 ? r.error.message : 'We could not open this ticket. Sign in, or open it from the browser you booked with.');
        return;
      }
      setT(r.data);
      setSvg(await QRCode.toString(r.data.code, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }));
    });
  }, [reference, urlToken]);

  if (error) return <div className="alert alert--warning" style={{ maxWidth: 520, marginInline: 'auto' }}>{error} <Link href={`/booking-status?ref=${reference}`}>Go to booking</Link></div>;
  if (!t) return <p className="muted center"><span className="spinner" aria-hidden="true" /> Loading your ticket…</p>;

  return (
    <article className="st-ticket" aria-labelledby="ticket-title">
      <div className="st-ticket__top">
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.72rem', marginBottom: 6 }}>E-ticket{t.isDemo ? ' · demo' : ''}</p>
        <h1 id="ticket-title">{t.service}</h1>
        <p>{t.package ?? 'Studio session'}</p>
      </div>
      <div className="st-ticket__body">
        <dl className="st-ticket__row">
          <div><dt>Date</dt><dd>{formatDateTime(t.startsAt, t.timezone, { hour: undefined, minute: undefined })}</dd></div>
          <div><dt>Time</dt><dd>{formatTime(t.startsAt, t.timezone)} – {formatTime(t.endsAt, t.timezone)}</dd></div>
        </dl>
        <dl className="st-ticket__row">
          <div><dt>Studio</dt><dd>{t.location.name}</dd></div>
          <div><dt>Booked by</dt><dd>{t.contactName}{t.attendees ? ` · ${t.attendees} people` : ''}</dd></div>
        </dl>
        <p className="small muted" style={{ margin: 0 }}>{t.location.addressLine1}, {t.location.city}</p>
        {t.balanceDueMinor > 0 && <p className="alert alert--warning small" style={{ margin: 0 }}>Balance due at the studio: {formatMoney(t.balanceDueMinor, t.currency)}</p>}
      </div>
      <div className="st-ticket__tear" aria-hidden="true" />
      <div className="st-ticket__qr">
        {t.checkedInAt ? (
          <p className="alert alert--success" style={{ margin: 0 }}>Checked in at {formatTime(t.checkedInAt, t.timezone)}</p>
        ) : (
          svg && <div role="img" aria-label={`QR code for ticket ${t.reference}`} dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        <p className="st-ticket__code" style={{ margin: 0 }}>{t.code}</p>
        <p className="small muted" style={{ margin: 0 }}>Show this QR code at the studio reception. Staff can also type the code.</p>
        <div className="cluster no-print" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn--sm" onClick={() => window.print()}>Print or save</button>
          <Link className="btn btn--ghost btn--sm" href={`/booking-status?ref=${t.reference}`}>Booking details</Link>
        </div>
      </div>
    </article>
  );
}
