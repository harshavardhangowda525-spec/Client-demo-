export default function Loading() {
  return (
    <div className="container" role="status" aria-busy="true" style={{ paddingBlock: 'var(--space-6)' }}>
      <span className="visually-hidden">Loading…</span>
      <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-lg)' }} />
      <div className="st-grid" style={{ marginTop: 'var(--space-6)' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="stack" style={{ gap: 'var(--space-2)' }}>
            <div className="skeleton" style={{ aspectRatio: '3 / 4' }} />
            <div className="skeleton" style={{ height: 16, width: '80%' }} />
            <div className="skeleton" style={{ height: 12, width: '50%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
