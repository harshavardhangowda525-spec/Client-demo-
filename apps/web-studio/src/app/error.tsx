'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="section">
      <div className="container center stack">
        <p className="eyebrow">Something went wrong</p>
        <h1>We couldn&rsquo;t load this page.</h1>
        <p className="lead">The booking service may be unavailable. Please try again in a moment.</p>
        <div className="cluster" style={{ justifyContent: 'center' }}><button className="btn" onClick={reset}>Try again</button></div>
      </div>
    </section>
  );
}
