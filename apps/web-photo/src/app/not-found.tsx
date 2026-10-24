import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container center stack">
        <p className="eyebrow">404</p>
        <h1>This page is out of frame.</h1>
        <p className="lead">The page you were looking for doesn&rsquo;t exist or has moved.</p>
        <div className="cluster" style={{ justifyContent: 'center' }}><Link className="btn" href="/">Back to home</Link></div>
      </div>
    </section>
  );
}
