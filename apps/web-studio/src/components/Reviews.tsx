export interface ReviewList {
  average: number | null;
  count: number;
  distribution: { stars: number; count: number }[];
  items: { id: string; rating: number; comment: string | null; author: string; createdAt: string; verified: boolean }[];
}

export const stars = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

/** Published reviews only. Each one comes from a customer who completed a booking. */
export function Reviews({ data }: { data: ReviewList | null }) {
  if (!data || data.count === 0) {
    return (
      <div className="st-panel">
        <p style={{ margin: 0 }}><strong>No reviews yet.</strong></p>
        <p className="small muted" style={{ margin: 0 }}>Reviews can only be written by customers after their session, from their booking page. We never add reviews ourselves.</p>
      </div>
    );
  }
  return (
    <div className="st-reviews">
      <div className="st-panel">
        <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>{data.average?.toFixed(1)}<span className="muted" style={{ fontSize: '1rem' }}>/5</span></p>
        <p className="small muted">{data.count} {data.count === 1 ? 'review' : 'reviews'} from customers who booked</p>
        <div className="st-dist">
          {data.distribution.map((d) => (
            <div key={d.stars}>
              <span>{d.stars}★</span>
              <meter min={0} max={data.count} value={d.count} aria-label={`${d.stars} star reviews`} />
              <span className="small muted">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="stack">
        {data.items.map((r) => (
          <article key={r.id} className="st-review">
            <header>
              <span><strong>{r.author}</strong> <span className="badge badge--success" style={{ marginLeft: 6 }}>Booked here</span></span>
              <span className="muted">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </header>
            <p className="st-stars" style={{ margin: '0 0 4px' }} aria-label={`${r.rating} out of 5 stars`}>{stars(r.rating)}</p>
            {r.comment && <p style={{ margin: 0 }}>{r.comment}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
