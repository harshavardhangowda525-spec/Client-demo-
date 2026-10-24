/** Decorative, static waveform (deterministic, no animation). */
export function Waveform({ bars = 64 }: { bars?: number }) {
  const heights = Array.from({ length: bars }, (_, i) => 18 + Math.round(Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) * 80));
  return (
    <div className="waveform" aria-hidden="true">
      {heights.map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}
    </div>
  );
}
