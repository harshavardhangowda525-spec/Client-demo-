import { formatCalendarDate } from '@studio/ui';
import { CopyCode } from './CopyCode';

export interface PublicOffer {
  id: string;
  code: string;
  title: string;
  description: string | null;
  terms: string | null;
  summary: string;
  validUntil: string | null;
  services: { name: string; slug: string }[];
  isDemo: boolean;
}

/** Coupon card: the discount is calculated on the server when the code is applied at checkout. */
export function OfferCard({ offer, showTerms }: { offer: PublicOffer; showTerms?: boolean }) {
  return (
    <article className="st-offer">
      <span className="st-offer__code">{offer.code}</span>
      <h3>{offer.title}</h3>
      <p>{offer.summary}{offer.services.length ? ` · ${offer.services.map((s) => s.name).join(', ')}` : ''}</p>
      {offer.validUntil && <p>Valid until {formatCalendarDate(offer.validUntil.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
      {showTerms && offer.terms && <p className="small">{offer.terms}</p>}
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <CopyCode code={offer.code} />
        {offer.isDemo && <span className="badge badge--demo">Sample offer</span>}
      </div>
    </article>
  );
}
