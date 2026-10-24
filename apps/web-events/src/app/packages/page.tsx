import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDuration, formatMoney, PageHeader } from '@studio/ui';
import { getCatalog, getSiteConfig } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Packages' };

const TIERS = [
  { name: 'Essentials', fit: 'Intimate gatherings', inclusions: ['Planning consultation', 'Supplier shortlist', 'Run-of-show document', 'On-the-day coordinator'] },
  { name: 'Signature', fit: 'Celebrations and offsites', inclusions: ['Everything in Essentials', 'Venue sourcing and site visit', 'Décor concept and styling', 'Guest management'] },
  { name: 'Bespoke', fit: 'Conferences and launches', inclusions: ['Dedicated event lead', 'Production and AV management', 'Staging and guest flow design', 'Post-event wrap-up'] },
];

export default async function PackagesPage() {
  const [catalog, site] = await Promise.all([getCatalog(BRAND), getSiteConfig(BRAND)]);
  const direct = catalog.services.filter((s) => s.bookingMode !== 'ENQUIRY');
  return (
    <>
      <PageHeader eyebrow="Packages" title="Ways to work with us" lead="Event packages are scoped individually, so they are priced by tailored quotation rather than a fixed list price. Consultations have a fixed price and can be booked online." />
      <section className="section">
        <div className="container stack-lg">
          <div className="grid grid--3">
            {TIERS.map((t, i) => (
              <div key={t.name} className={`path ${i === 1 ? 'path--accent' : ''}`}>
                <span className="eyebrow">{t.fit}</span>
                <h2 style={{ fontSize: 'var(--step-2)' }}>{t.name}</h2>
                <p className="small muted" style={{ margin: 0 }}>Priced by quotation · sample package structure</p>
                <ul className="inclusions">{t.inclusions.map((x) => <li key={x}>{x}</li>)}</ul>
                <div><Link className="btn btn--sm" href="/enquire">Request a proposal</Link></div>
              </div>
            ))}
          </div>
          <div className="card">
            <h2 style={{ fontSize: 'var(--step-2)' }}>Fixed-price services</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Service</th><th>Duration</th><th>Price</th><th></th></tr></thead>
                <tbody>
                  {direct.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}<div className="small muted">{s.addOns.map((a) => `Optional: ${a.name} (${formatMoney(a.priceMinor)})`).join(' · ')}</div></td>
                      <td>{formatDuration(s.defaultDurationMin)}</td>
                      <td className="price">{formatMoney(s.basePriceMinor)}</td>
                      <td><Link className="btn btn--sm" href={`/book?service=${s.slug}`}>Book</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">Prices exclude {site.pricing.taxLabel}. All values are sample data.</p>
          </div>
        </div>
      </section>
    </>
  );
}
