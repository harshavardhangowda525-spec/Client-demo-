import Link from 'next/link';

/** Fixed bottom bar on small screens that jumps to the booking panel. */
export function MobileBookBar({ price, label, href }: { price: string; label: string; href: string }) {
  return (
    <div className="st-mobilebar">
      <span><span className="small muted" style={{ display: 'block' }}>Price</span><strong>{price}</strong></span>
      <Link className="btn" href={href}>{label}</Link>
    </div>
  );
}
