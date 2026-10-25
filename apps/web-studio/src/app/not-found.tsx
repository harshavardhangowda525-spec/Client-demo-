import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container center stack">
        <p className="eyebrow">404</p>
        <h1>We couldn&rsquo;t find that page.</h1>
        <p className="lead">The service or page may have moved or is no longer offered.</p>
        <div className="cluster" style={{ justifyContent: 'center' }}>
          <Link className="btn" href="/services">Browse services</Link>
          <Link className="btn btn--ghost" href="/">Home</Link>
        </div>
      </div>
    </section>
  );
}
