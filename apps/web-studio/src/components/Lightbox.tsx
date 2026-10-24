'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface GalleryItem {
  key: string;
  thumb: ReactNode;
  src: string | null;
  alt: string;
  caption?: string | null;
}

/** Thumbnail grid that opens a keyboard-accessible full-screen viewer. */
export function Gallery({ items, className = 'st-gallery' }: { items: GalleryItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const viewable = items.filter((i) => i.src);

  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, []);

  useEffect(() => {
    if (open === null) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % viewable.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + viewable.length) % viewable.length));
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close, viewable.length]);

  const current = open === null ? null : viewable[open];

  return (
    <>
      <div className={className}>
        {items.map((item) => (
          <figure key={item.key} style={{ margin: 0 }}>
            {item.src ? (
              <button
                type="button"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setOpen(viewable.indexOf(item));
                }}
                aria-label={`Enlarge image${item.alt ? `: ${item.alt}` : ''}`}
                style={{ display: 'block', width: '100%' }}
              >
                {item.thumb}
              </button>
            ) : (
              item.thumb
            )}
            {item.caption && <figcaption>{item.caption}</figcaption>}
          </figure>
        ))}
      </div>
      {current && (
        <div className="st-lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={(e) => e.target === e.currentTarget && close()}>
          <figure style={{ margin: 0, textAlign: 'center' }}>
            <img src={current.src!} alt={current.alt} />
            <figcaption>{current.caption ?? current.alt} · {open! + 1} / {viewable.length}</figcaption>
          </figure>
          <button ref={closeBtn} type="button" className="st-lightbox__btn" style={{ top: 16, right: 16 }} onClick={close} aria-label="Close viewer">✕</button>
          {viewable.length > 1 && (
            <>
              <button type="button" className="st-lightbox__btn" style={{ left: 16, top: '50%' }} onClick={() => setOpen((open! - 1 + viewable.length) % viewable.length)} aria-label="Previous image">‹</button>
              <button type="button" className="st-lightbox__btn" style={{ right: 16, top: '50%' }} onClick={() => setOpen((open! + 1) % viewable.length)} aria-label="Next image">›</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
