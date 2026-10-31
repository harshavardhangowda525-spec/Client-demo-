import type { Metadata } from 'next';
import { PageHeader } from '@studio/ui';
import { serverApi } from '@studio/ui/server';
import { OfferCard, type PublicOffer } from '../../components/OfferCard';

export const metadata: Metadata = { title: 'Offers' };

export default async function Page() {
  const offers = (await serverApi<PublicOffer[]>('/api/v1/studio/offers')) ?? [];
  return (
    <>
      <PageHeader eyebrow="Offers" title="Offers and coupon codes" lead="Enter a code at checkout. The discount is checked and calculated on our server before you pay." />
      <section className="section section--tight">
        <div className="container">
          {offers.length ? (
            <div className="st-offers">{offers.map((o) => <OfferCard key={o.id} offer={o} showTerms />)}</div>
          ) : (
            <div className="empty">There are no offers running right now.</div>
          )}
        </div>
      </section>
    </>
  );
}
