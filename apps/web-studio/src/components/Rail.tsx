'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** Horizontal scroll-snap rail with arrow buttons on wide screens (touch/trackpad scroll elsewhere). */
export function Rail({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const t = track.current;
    if (!t) return;
    setEdges({ start: t.scrollLeft <= 4, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const t = track.current;
    t?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      t?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85 });

  return (
    <div className="st-rail">
      <button type="button" className="st-rail__btn st-rail__btn--prev" onClick={() => scroll(-1)} disabled={edges.start} aria-label={`Scroll ${label} left`}>‹</button>
      <div className="st-rail__track" ref={track} role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <button type="button" className="st-rail__btn st-rail__btn--next" onClick={() => scroll(1)} disabled={edges.end} aria-label={`Scroll ${label} right`}>›</button>
    </div>
  );
}
