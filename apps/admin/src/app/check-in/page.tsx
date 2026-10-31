'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { formatDateTime, formatMoney } from '@studio/ui';
import { errorText, mutate } from '../../lib/client';

interface Result {
  reference: string;
  contactName: string;
  service: string;
  location: string;
  startsAt: string;
  timezone: string;
  attendees: number | null;
  balanceDueMinor: number;
  alreadyCheckedIn: boolean;
  checkedInAt: string;
}

/** Scan a customer's e-ticket QR code (camera) or type the code printed under it. */
export default function CheckInPage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastCode = useRef('');

  const submit = useCallback(async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    setErr(null);
    const r = await mutate<Result>('/api/v1/admin/check-in', 'POST', { code: v });
    setBusy(false);
    if (r.ok) setResult(r.data);
    else {
      setResult(null);
      setErr(errorText(r.error) ?? 'Check-in failed');
    }
  }, [busy]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
  }, []);

  async function start() {
    setErr(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setScanning(true);
    } catch {
      setErr('Could not open the camera. Allow camera access in the browser, or type the code below.');
    }
  }

  useEffect(() => {
    if (!scanning || !video.current || !stream.current) return;
    const v = video.current;
    v.srcObject = stream.current;
    void v.play();
    let raf = 0;
    const tick = () => {
      const c = canvas.current;
      if (c && v.readyState >= 2) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const found = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (found?.data && found.data !== lastCode.current) {
          lastCode.current = found.data;
          setCode(found.data);
          stop();
          void submit(found.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scanning, stop, submit]);

  useEffect(() => stop, [stop]);

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1 style={{ margin: 0 }}>Check-in</h1>
      <p className="small muted" style={{ margin: 0 }}>Scan the QR code on the customer&rsquo;s e-ticket, or type the code printed under it. Check-in opens 3 hours before a session. Scanning the same ticket twice is safe: it shows the first check-in.</p>

      <section className="panel stack">
        {scanning ? (
          <>
            <video ref={video} muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000' }} aria-label="Camera view" />
            <button type="button" className="btn btn--ghost btn--sm" onClick={stop}>Stop camera</button>
          </>
        ) : (
          <button type="button" className="btn" onClick={start}>Scan QR code with camera</button>
        )}
        <canvas ref={canvas} hidden />
        <form className="cluster" onSubmit={(e) => { e.preventDefault(); lastCode.current = code; void submit(code); }}>
          <label htmlFor="ticket-code" className="visually-hidden">Ticket code</label>
          <input id="ticket-code" className="input mono" style={{ flex: 1, minWidth: 220 }} placeholder="e.g. PH-7K3Q9XMR.H4KZ8MQ2TW" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" />
          <button type="submit" className="btn" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Check in'}</button>
        </form>
      </section>

      {err && <div className="alert alert--danger" role="alert">{err}</div>}
      {result && (
        <section className={`alert ${result.alreadyCheckedIn ? 'alert--warning' : 'alert--success'}`} role="status">
          <p style={{ margin: 0, fontWeight: 700 }}>{result.alreadyCheckedIn ? `Already checked in at ${formatDateTime(result.checkedInAt, result.timezone)}` : 'Checked in'}</p>
          <p style={{ margin: '4px 0 0' }}><strong>{result.contactName}</strong>{result.attendees ? ` · ${result.attendees} people` : ''} · <span className="mono">{result.reference}</span></p>
          <p style={{ margin: 0 }}>{result.service} · {result.location} · {formatDateTime(result.startsAt, result.timezone)}</p>
          {result.balanceDueMinor > 0 && <p style={{ margin: '4px 0 0', fontWeight: 700 }}>Collect balance: {formatMoney(result.balanceDueMinor)}</p>}
        </section>
      )}
    </div>
  );
}
