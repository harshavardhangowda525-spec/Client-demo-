import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDuration, formatMoney, PageHeader } from '@studio/ui';
import { getCatalog, getSiteConfig } from '@studio/ui/server';
import { BRAND } from '../../site';

export const metadata: Metadata = { title: 'Packages & pricing' };

export default async function PackagesPage() {
  const [catalog, site] = await Promise.all([getCatalog(BRAND), getSiteConfig(BRAND)]);
  const addOns = [...new Map(catalog.services.flatMap((s) => s.addOns).map((a) => [a.id, a])).values()];
  return (
    <>
      <PageHeader eyebrow="Packages & pricing" title="Transparent pricing" lead={`Every price below is calculated by the same server-side pricing engine used at checkout. ${site.pricing.taxLabel} is added at checkout, and a ${site.pricing.depositBps / 100}% deposit secures a booking.`}>
        <span className="badge badge--demo">Sample prices, tax rate and deposit policy</span>
      </PageHeader>
      <section className="section">
        <div className="container stack-lg">
          {catalog.services.map((s) => (
            <div key={s.id} className="card" style={{ padding: 'var(--space-6)' }}>
              <div className="section-head" style={{ marginBottom: 'var(--space-4)' }}>
                <div>
                  <p className="eyebrow">{s.category?.name}</p>
                  <h2 style={{ fontSize: 'var(--step-2)' }}>{s.name}</h2>
                </div>
                <Link className="btn btn--sm" href={`/book?service=${s.slug}`}>{s.bookingMode === 'REQUEST' ? 'Request' : 'Book'}</Link>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Option</th><th>Duration</th><th>Includes</th><th>Price</th></tr></thead>
                  <tbody>
                    {s.packages.length ? (
                      s.packages.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong>{p.isFeatured && <> <span className="badge">Popular</span></>}</td>
                          <td>{formatDuration(p.durationMin)}</td>
                          <td className="small">{p.includes.join(', ')}</td>
                          <td className="price">{formatMoney(p.priceMinor)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>{s.pricingModel === 'HOURLY' ? 'Hourly' : 'Standard session'}</td>
                        <td>{formatDuration(s.minDurationMin)}{s.maxDurationMin !== s.minDurationMin ? ` to ${formatDuration(s.maxDurationMin)}` : ''}</td>
                        <td className="small">{s.summary}</td>
                        <td className="price">{s.pricingModel === 'HOURLY' ? `${formatMoney(s.hourlyRateMinor)} / hour` : formatMoney(s.basePriceMinor)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div>
            <h2>Add-ons</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Add-on</th><th>Description</th><th>Price</th></tr></thead>
                <tbody>
                  {addOns.map((a) => (
                    <tr key={a.id}><td>{a.name}</td><td className="small muted">{a.description}</td><td className="price">{formatMoney(a.priceMinor)}{a.pricing === 'PER_HOUR' ? ' / hour' : ''}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
