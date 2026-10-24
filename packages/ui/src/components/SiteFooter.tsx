import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SiteShell } from '../lib/types';

export function SiteFooter({ shell, email, phone, tagline }: { shell: SiteShell; email: string; phone?: string; tagline: string }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <p className="brand-mark" style={{ marginBottom: 'var(--space-3)' }}>{shell.name}</p>
            <p style={{ color: 'var(--inverse-muted)', fontSize: '0.92rem' }}>{tagline}</p>
            <p style={{ fontSize: '0.92rem' }}>
              <a href={`mailto:${email}`}>{email}</a>
              {phone ? (
                <>
                  <br />
                  <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
                </>
              ) : null}
            </p>
            <p style={{ color: 'var(--inverse-muted)', fontSize: '0.8rem' }}>Placeholder contact details (example.com) for demonstration.</p>
          </div>
          {shell.footerColumns.map((col) => (
            <div key={col.title}>
              <h2>{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2>Also in this demo</h2>
            <ul>
              {shell.siblings.map((s) => (
                <li key={s.href}>
                  <a href={s.href}>{s.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footer-legal">
          <p>
            Demonstration website built by Infinity Web &amp; Apps. Services, prices, locations and imagery are sample content.
          </p>
          <p>
            <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/booking-status">Booking status</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function DemoBar() {
  return (
    <div className="demo-bar" role="note">
      Demonstration site: sample services, prices, availability and AI-generated imagery. Payments are simulated and no money is taken.
    </div>
  );
}

export function PageHeader({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="container">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
    </div>
  );
}
