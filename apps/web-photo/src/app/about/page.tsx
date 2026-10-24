import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@studio/ui';
import { SampleImage } from '@studio/ui/server';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About" title="A studio built around craft" lead="This page is a layout for the studio's story. The text below is placeholder copy to be replaced with the business's verified history, team and approach." />
      <section className="section">
        <div className="container split">
          <SampleImage imageKey="photo-architecture" ratio="3x4" tag />
          <div className="stack">
            <span className="eyebrow">Our approach (placeholder)</span>
            <h2>Considered images, <em>made carefully</em>.</h2>
            <p>Every project starts with a conversation about what the images need to do. We plan light, location and pacing around that purpose, and deliver a finished edit you can use straight away.</p>
            <p>The business&rsquo;s real story, team, credentials and client list will be added here only after they are provided and verified. We don&rsquo;t publish awards, testimonials or statistics that haven&rsquo;t been confirmed.</p>
            <div className="cluster"><Link className="btn" href="/contact">Get in touch</Link><Link className="btn btn--ghost" href="/portfolio">See sample work</Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
