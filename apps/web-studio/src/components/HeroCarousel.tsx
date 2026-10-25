'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

export interface HeroSlide {
  id: string;
  media: ReactNode;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  offerText: string | null;
}

const INTERVAL = 6000;

/**
 * Accessible banner carousel: auto-advances only when the visitor has not asked
 * for reduced motion, pauses on hover/focus, and always offers a pause control.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const running = slides.length > 1 && !paused && !hovered && !reduced;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), INTERVAL);
    return () => clearInterval(t);
  }, [running, slides.length]);

  if (!slides.length) return null;
  const go = (i: number) => setIndex((i + slides.length) % slides.length);

  return (
    <section
      className="st-hero"
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      <div className="st-hero__viewport" aria-live={running ? 'off' : 'polite'}>
        {slides.map((s, i) => (
          <div key={s.id} className="st-hero__slide" data-active={i === index} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}`} aria-hidden={i !== index} inert={i !== index}>
            {s.media}
            <div className="st-hero__copy">
              {s.offerText && <span className="st-hero__offer">{s.offerText}</span>}
              {i === 0 ? <h1 style={{ fontSize: 'clamp(1.4rem, 1rem + 2.4vw, 2.6rem)', color: '#fff', marginBottom: 'var(--space-2)' }}>{s.title}</h1> : <h2>{s.title}</h2>}
              {s.subtitle && <p>{s.subtitle}</p>}
              {s.ctaHref && s.ctaLabel && <Link href={s.ctaHref} className="btn">{s.ctaLabel}</Link>}
            </div>
          </div>
        ))}
        {slides.length > 1 && !reduced && (
          <button type="button" className="st-hero__pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? 'Play' : 'Pause'}<span className="visually-hidden"> slideshow</span>
          </button>
        )}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" className="st-hero__nav st-hero__nav--prev" onClick={() => go(index - 1)} aria-label="Previous slide">‹</button>
          <button type="button" className="st-hero__nav st-hero__nav--next" onClick={() => go(index + 1)} aria-label="Next slide">›</button>
          <div className="st-hero__dots">
            {slides.map((s, i) => (
              <button key={s.id} type="button" onClick={() => go(i)} aria-current={i === index} aria-label={`Show slide ${i + 1}: ${s.title}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
