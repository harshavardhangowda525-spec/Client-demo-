import type { Faq, PublicLocation } from '../lib/types';
import { DAY_NAMES } from '../lib/format';

export function FaqList({ faqs }: { faqs: Faq[] }) {
  if (!faqs.length) return <div className="empty">No questions published yet.</div>;
  return (
    <div className="faq">
      {faqs.map((f) => (
        <details key={f.id}>
          <summary>{f.question}</summary>
          <div><p>{f.answer}</p></div>
        </details>
      ))}
    </div>
  );
}

function hoursSummary(hours: PublicLocation['openingHours']) {
  const byDay = new Map<number, string[]>();
  for (const h of hours) byDay.set(h.dayOfWeek, [...(byDay.get(h.dayOfWeek) ?? []), `${h.open}–${h.close === '24:00' ? 'midnight' : h.close}`]);
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: DAY_NAMES[d]!, value: byDay.get(d)?.join(', ') ?? 'Closed' }));
}

export function LocationCard({ location, mapsKey, resourceLabel = 'Spaces' }: { location: PublicLocation; mapsKey: string | null; resourceLabel?: string }) {
  const address = [location.addressLine1, location.addressLine2, location.city, location.region, location.postalCode].filter(Boolean).join(', ');
  return (
    <article className="card stack" aria-labelledby={`loc-${location.id}`}>
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <h3 id={`loc-${location.id}`} style={{ margin: 0 }}>{location.name}</h3>
        {location.isDemo && <span className="badge badge--demo">Demonstration location</span>}
      </div>
      <address style={{ fontStyle: 'normal' }} className="muted">{address}</address>
      {location.description && <p className="small">{location.description}</p>}
      {mapsKey && !location.isDemo ? (
        <iframe
          title={`Map of ${location.name}`}
          src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${encodeURIComponent(address)}`}
          style={{ width: '100%', aspectRatio: '16/9', border: 0, borderRadius: 'var(--radius)' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          {location.isDemo ? 'A map and directions will appear once the real address is provided and a maps provider is configured.' : 'Map not configured.'}
        </p>
      )}
      <div className="split" style={{ alignItems: 'start', gap: 'var(--space-5)' }}>
        <div>
          <p className="label">Opening hours {location.openingHours.some((h) => h.isDemo) && <span className="badge badge--demo">Sample</span>}</p>
          <table className="table">
            <tbody>
              {hoursSummary(location.openingHours).map((r) => (
                <tr key={r.day}><th scope="row" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.9rem' }}>{r.day}</th><td>{r.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {location.resources.length > 0 && (
          <div>
            <p className="label">{resourceLabel}</p>
            <ul className="small">
              {location.resources.map((r) => (
                <li key={r.id}>{r.name}{r.capacity ? ` · up to ${r.capacity}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

export function LegalContent({ kind, siteName }: { kind: 'privacy' | 'terms'; siteName: string }) {
  return (
    <div className="stack">
      <div className="alert alert--warning">
        <strong>Template for review</strong>
        <p>This is placeholder text prepared for the demonstration. It is not legal advice and has not been approved by {siteName}. The final policy must be reviewed by the business and its legal advisers before launch.</p>
      </div>
      {kind === 'privacy' ? (
        <>
          <h2>What we collect</h2>
          <p>When you book, enquire or contact us we collect the details you enter: your name, email address, optional phone number, booking preferences and any notes you add. If you create an account we store your login email and a securely hashed password.</p>
          <h2>How we use it</h2>
          <p>We use your details to manage your booking or enquiry, to contact you about it, and to keep the records required to run the business. We do not sell your data.</p>
          <h2>Payments</h2>
          <p>Card payments are handled by the payment provider. This website never receives or stores your full card details. In demonstration mode no payment details are collected at all.</p>
          <h2>Your choices</h2>
          <p>You can view and update your profile from your account and ask the team to correct or delete your information, subject to legal record-keeping requirements.</p>
          <h2>Contact</h2>
          <p>Questions about privacy can be sent through the contact page.</p>
        </>
      ) : (
        <>
          <h2>Bookings</h2>
          <p>A booking is confirmed only when the booking status shows Confirmed. Submitting a form or enquiry does not by itself confirm a booking. Slots may be held for a limited time while payment is completed.</p>
          <h2>Prices</h2>
          <p>Prices are calculated by our system at the time of booking and shown with an itemised breakdown before payment. Prices on this demonstration site are samples.</p>
          <h2>Cancellations and changes</h2>
          <p>Cancellation and refund terms will follow the business&rsquo;s approved policy. Until it is confirmed, cancellation requests are reviewed case by case.</p>
          <h2>Liability</h2>
          <p>To be completed by the business and its legal advisers.</p>
        </>
      )}
    </div>
  );
}
