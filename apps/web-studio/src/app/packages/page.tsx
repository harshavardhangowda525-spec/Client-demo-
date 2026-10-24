import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDuration, formatMoney, PageHeader } from '@studio/ui';
import { getCatalog, getSiteConfig } from '@studio/ui/server';
import { BRAND, HOME_BRANDS } from '../../site';

export const metadata: Metadata = { title: 'Packages' };

export default async function Page() {
  const [site, ...catalogs] = await Promise.all([getSiteConfig(BRAND), ...HOME_BRANDS.map(getCatalog)]);
  const services = catalogs.flatMap((c) => c.services).filter((s) => s.packages.length > 0);
  return (
    <>
      <PageHeader eyebrow="Packages" title="Packages and pricing" lead={`Fixed-scope packages with what's included. Prices exclude ${site.pricing.taxLabel}, which is added at checkout with an itemised breakdown.`}>
        {site.pricing.isSample && <p className="badge badge--demo" style={{ margin: 0 }}>Sample prices</p>}
      </PageHeader>
      <section className="section section--tight">
        <div className="container stack-lg">
          {services.map((s) => (
            <section key={s.id} aria-labelledby={`pk-${s.slug}`}>
              <div className="st-section__head">
                <h2 id={`pk-${s.slug}`}>{s.name}</h2>
                <Link href={`/service/${s.slug}`}>Service details ›</Link>
              </div>
              <div className="grid grid--3">
                {s.packages.map((p) => (
                  <div key={p.id} className="st-panel stack" style={{ gap: 'var(--space-2)', borderColor: p.isFeatured ? 'var(--accent)' : undefined }}>
                    {p.isFeatured && <span className="badge badge--accent" style={{ width: 'fit-content' }}>Most chosen</span>}
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{p.name}</h3>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem' }}>{formatMoney(p.priceMinor)}</p>
                    <p className="small muted" style={{ margin: 0 }}>{formatDuration(p.durationMin)}</p>
                    <ul className="small" style={{ margin: 0, paddingLeft: '1.1em' }}>{p.includes.map((x) => <li key={x}>{x}</li>)}</ul>
                    <Link className="btn btn--sm" style={{ marginTop: 'auto' }} href={`/service/${s.slug}?package=${p.id}#book`}>Choose {p.name}</Link>
                  </div>
                ))}
              </div>
              {s.addOns.length > 0 && <p className="small muted">Add-ons: {s.addOns.map((a) => `${a.name} (${formatMoney(a.priceMinor)}${a.pricing === 'PER_HOUR' ? '/hr' : ''})`).join(' · ')}</p>}
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
