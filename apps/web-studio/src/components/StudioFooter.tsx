import Link from 'next/link';
import type { StudioCategory } from '../lib/types';

const SOCIAL_LABELS: Record<string, string> = { instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', facebook: 'Facebook', x: 'X' };

export function StudioFooter({ site, categories }: { site: { name: string; tagline: string; email: string; phone?: string; social?: Record<string, string | undefined> }; categories: StudioCategory[] }) {
  const socials = Object.entries(site.social ?? {}).filter((e): e is [string, string] => !!e[1] && /^https:\/\//.test(e[1]));
  return (
    <footer className="st-footer">
      <div className="container">
        <div className="st-footer__grid">
          <div>
            <p style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff', marginBottom: 'var(--space-2)' }}>{site.name}</p>
            <p style={{ fontSize: '0.88rem' }}>{site.tagline}</p>
            <p style={{ fontSize: '0.88rem', margin: 0 }}><a href={`mailto:${site.email}`}>{site.email}</a></p>
            {site.phone && <p style={{ fontSize: '0.88rem' }}><a href={`tel:${site.phone.replace(/\s/g, '')}`}>{site.phone}</a></p>}
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Placeholder contact details for the demo.</p>
            {socials.length > 0 && (
              <ul style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                {socials.map(([k, href]) => <li key={k}><a href={href} rel="noopener noreferrer" target="_blank">{SOCIAL_LABELS[k] ?? k}</a></li>)}
              </ul>
            )}
          </div>
          <div>
            <h2>Services</h2>
            <ul>
              {categories.map((c) => <li key={c.slug}><Link href={`/services/${c.slug}`}>{c.name}</Link></li>)}
            </ul>
          </div>
          <div>
            <h2>Explore</h2>
            <ul>
              <li><Link href="/services">All services</Link></li>
              <li><Link href="/packages">Packages</Link></li>
              <li><Link href="/portfolio">Portfolio</Link></li>
              <li><Link href="/studio">Studio &amp; equipment</Link></li>
              <li><Link href="/enquire">Request a custom quote</Link></li>
            </ul>
          </div>
          <div>
            <h2>Help</h2>
            <ul>
              <li><Link href="/account">My account</Link></li>
              <li><Link href="/booking-status">Booking status</Link></li>
              <li><Link href="/enquiry-status">Enquiry status</Link></li>
              <li><Link href="/faqs">FAQs</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h2>Policies</h2>
            <ul>
              <li><Link href="/policies/privacy">Privacy policy</Link></li>
              <li><Link href="/policies/terms">Terms and conditions</Link></li>
              <li><Link href="/policies/cancellation-refund">Cancellation and refunds</Link></li>
            </ul>
          </div>
        </div>
        <div className="st-footer__legal">
          <p>Demonstration platform built by Infinity Web &amp; Apps. Services, prices, locations, equipment and imagery are sample content.</p>
          <p>Payments on this demo are simulated or run in Razorpay test mode; no money is taken.</p>
        </div>
      </div>
    </footer>
  );
}
