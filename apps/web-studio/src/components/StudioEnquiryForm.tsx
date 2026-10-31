'use client';

import { useRef, useState } from 'react';
import { api, fieldErrors, formatMoney, rememberAccessToken, TextField, type Me } from '@studio/ui';

export interface EnquiryServiceOption {
  id: string;
  slug: string;
  name: string;
  brand: string;
  group: string;
}

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp';

type UploadState = { name: string; status: 'pending' | 'done' | 'error'; message?: string };

/** Project brief for a custom quotation. Creates an enquiry (never a booking), then uploads any attachments. */
export function StudioEnquiryForm({ services, locations, me, initialService, today }: { services: EnquiryServiceOption[]; locations: { id: string; name: string; city: string }[]; me: Me | null; initialService?: string; today: string }) {
  const pre = services.find((s) => s.slug === initialService);
  const [selected, setSelected] = useState<string[]>(pre ? [pre.id] : []);
  const [f, setF] = useState({ eventType: '', preferredDate: '', alternateDate: '', locationId: '', venueDetails: '', expectedAttendance: '', budgetMin: '', budgetMax: '', expectedDuration: '', deliverables: '', companyName: me?.profile.company ?? '', notes: '' });
  const [contact, setContact] = useState({ name: me?.profile.fullName ?? '', email: me?.profile.email ?? '', phone: me?.profile.phone ?? '' });
  const [accept, setAccept] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string; token: string; uploads: UploadState[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const brands = new Set(services.filter((s) => selected.includes(s.id)).map((s) => s.brand));

  function addFiles(list: FileList | null) {
    setFileError(null);
    const incoming = Array.from(list ?? []);
    const next = [...files];
    for (const file of incoming) {
      if (next.length >= MAX_FILES) {
        setFileError(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      if (file.size > MAX_BYTES) {
        setFileError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) {
        setFileError(`${file.name}: only PDF, JPG, PNG or WebP files are accepted.`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const rupees = (v: string) => (v.trim() ? Math.round(Number(v) * 100) : null);
    const payload = {
      eventType: f.eventType,
      preferredDate: f.preferredDate,
      alternateDate: f.alternateDate || null,
      locationId: f.locationId || null,
      venueDetails: f.venueDetails || undefined,
      expectedAttendance: f.expectedAttendance,
      serviceIds: selected,
      budgetMinMinor: rupees(f.budgetMin),
      budgetMaxMinor: rupees(f.budgetMax),
      expectedDuration: f.expectedDuration || undefined,
      deliverables: f.deliverables ? Number(f.deliverables) : null,
      companyName: f.companyName || undefined,
      notes: f.notes || undefined,
      contact: { ...contact, phone: contact.phone || undefined },
      acceptTerms: accept,
    };
    if (brands.size > 1) {
      setServerError('Please send a separate brief for each group (photography & video, podcast, or events).');
      return;
    }
    setBusy(true);
    const res = await api<{ reference: string; accessToken: string }>('/api/v1/studio/enquiries', { body: payload });
    if (!res.ok) {
      setBusy(false);
      setErrors(fieldErrors(res.error));
      setServerError(res.error.message);
      return;
    }
    const { reference, accessToken } = res.data;
    rememberAccessToken(reference, accessToken);
    const uploads: UploadState[] = files.map((file) => ({ name: file.name, status: 'pending' }));
    setDone({ reference, token: accessToken, uploads: [...uploads] });
    for (let i = 0; i < files.length; i++) {
      const body = new FormData();
      body.append('file', files[i]!);
      try {
        const r = await fetch(`/api/v1/enquiries/${reference}/attachments`, { method: 'POST', body, headers: { 'x-booking-token': accessToken }, credentials: 'same-origin' });
        if (r.ok) uploads[i] = { ...uploads[i]!, status: 'done' };
        else {
          const j = await r.json().catch(() => null);
          uploads[i] = { ...uploads[i]!, status: 'error', message: j?.error?.message ?? 'Upload failed.' };
        }
      } catch {
        uploads[i] = { ...uploads[i]!, status: 'error', message: 'Network error.' };
      }
      setDone({ reference, token: accessToken, uploads: [...uploads] });
    }
    setBusy(false);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <div className="st-panel stack" role="status">
        <p className="eyebrow" style={{ margin: 0 }}>Brief received</p>
        <h2 style={{ margin: 0 }}>Thank you. Your reference is <span className="mono">{done.reference}</span></h2>
        <p style={{ margin: 0 }}><strong>This is not a booking yet.</strong> The team will review your brief and send an itemised quotation. Nothing is reserved until you accept a quotation and the team confirms it.</p>
        {done.uploads.length > 0 && (
          <div>
            <p className="label">Attachments</p>
            <ul className="small" style={{ margin: 0 }}>
              {done.uploads.map((u, i) => (
                <li key={i}>{u.name}: {u.status === 'pending' ? 'uploading…' : u.status === 'done' ? 'uploaded' : <span className="field-error" style={{ display: 'inline' }}>{u.message}</span>}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="cluster">
          <a className="btn" href={`/enquiry-status?ref=${done.reference}&token=${encodeURIComponent(done.token)}`}>View enquiry status</a>
          <a className="btn btn--ghost" href="/">Back to home</a>
        </div>
      </div>
    );
  }

  const groups = [...new Set(services.map((s) => s.group))];
  return (
    <form className="form" noValidate onSubmit={submit}>
      {serverError && <div className="alert alert--danger" role="alert">{serverError}</div>}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 'var(--space-2)' }}>Services you&rsquo;re interested in</legend>
        {groups.map((g) => (
          <div key={g} style={{ marginBottom: 'var(--space-3)' }}>
            <p className="small muted" style={{ margin: '0 0 var(--space-2)' }}>{g}</p>
            <div className="st-chips">
              {services.filter((s) => s.group === g).map((s) => (
                <button key={s.id} type="button" className="chip" aria-pressed={selected.includes(s.id)} onClick={() => setSelected((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}>{s.name}</button>
              ))}
            </div>
          </div>
        ))}
        {brands.size > 1 && <p className="field-error">Each group (photography &amp; video, podcast, events) is quoted separately. Please choose from one group per brief.</p>}
      </fieldset>

      <div className="form-row form-row--2">
        <TextField id="eventType" label="Project type" value={f.eventType} onChange={set('eventType')} error={errors.eventType} required hint="e.g. product launch campaign, 6-episode video podcast" />
        <TextField id="companyName" label="Company / brand (optional)" autoComplete="organization" value={f.companyName} onChange={set('companyName')} error={errors.companyName} />
      </div>
      <div className="form-row form-row--2">
        <TextField id="preferredDate" label="Preferred date" type="date" min={today} value={f.preferredDate} onChange={set('preferredDate')} error={errors.preferredDate} required />
        <TextField id="alternateDate" label="Alternative date (optional)" type="date" min={today} value={f.alternateDate} onChange={set('alternateDate')} error={errors.alternateDate} />
      </div>
      <div className="form-row form-row--2">
        <div className="field">
          <label htmlFor="locationId">Studio location (optional)</label>
          <select id="locationId" className="select" value={f.locationId} onChange={(e) => set('locationId')(e.target.value)}>
            <option value="">No preference / on location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}
          </select>
        </div>
        <TextField id="venueDetails" label="Shoot location details (optional)" value={f.venueDetails} onChange={set('venueDetails')} error={errors.venueDetails} hint="If on location: address or area" />
      </div>
      <div className="form-row form-row--2">
        <TextField id="expectedAttendance" label="People on camera / in session" inputMode="numeric" value={f.expectedAttendance} onChange={set('expectedAttendance')} error={errors.expectedAttendance} required />
        <TextField id="expectedDuration" label="Expected duration (optional)" value={f.expectedDuration} onChange={set('expectedDuration')} error={errors.expectedDuration} hint="e.g. half day, 2 days" />
      </div>
      <div className="form-row form-row--2">
        <TextField id="deliverables" label="Number of deliverables (optional)" inputMode="numeric" value={f.deliverables} onChange={set('deliverables')} error={errors.deliverables} hint="Edited photos, videos or episodes" />
        <div className="form-row form-row--2" style={{ gap: 'var(--space-3)' }}>
          <TextField id="budgetMin" label="Budget from (₹)" inputMode="numeric" value={f.budgetMin} onChange={set('budgetMin')} error={errors.budgetMinMinor} />
          <TextField id="budgetMax" label="Budget to (₹)" inputMode="numeric" value={f.budgetMax} onChange={set('budgetMax')} error={errors.budgetMaxMinor} />
        </div>
      </div>
      {(f.budgetMin || f.budgetMax) && <p className="small muted" style={{ marginTop: 'calc(var(--space-3) * -1)' }}>Budget: {f.budgetMin ? formatMoney(Number(f.budgetMin) * 100 || 0) : '—'} to {f.budgetMax ? formatMoney(Number(f.budgetMax) * 100 || 0) : '—'}</p>}
      <div className="field">
        <label htmlFor="notes">Project brief</label>
        <textarea id="notes" className="textarea" rows={6} value={f.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Goals, style references, deliverable formats, deadlines…" aria-invalid={!!errors.notes} />
        {errors.notes && <p className="field-error">{errors.notes}</p>}
      </div>

      <div className="field">
        <label htmlFor="files">Reference files (optional)</label>
        <input ref={fileInput} id="files" type="file" multiple accept={ACCEPT} onChange={(e) => addFiles(e.target.files)} disabled={files.length >= MAX_FILES} aria-describedby="files-hint" />
        <p className="hint" id="files-hint">Up to {MAX_FILES} files, PDF, JPG, PNG or WebP, 10 MB each. Files are checked on upload and are visible only to the studio team.</p>
        {fileError && <p className="field-error" role="alert">{fileError}</p>}
        {files.length > 0 && (
          <ul className="small" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="cluster" style={{ justifyContent: 'space-between' }}>
                <span>{file.name} <span className="muted">({(file.size / 1024 / 1024).toFixed(1)} MB)</span></span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove<span className="visually-hidden"> {file.name}</span></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 'var(--space-2)' }}>Your details</legend>
        <div className="form-row form-row--2">
          <TextField id="name" label="Full name" autoComplete="name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} error={errors['contact.name']} required />
          <TextField id="email" label="Email" type="email" autoComplete="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} error={errors['contact.email']} required readOnly={!!me} />
        </div>
        <TextField id="phone" label="Phone (optional)" type="tel" autoComplete="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} error={errors['contact.phone']} />
      </fieldset>
      <label className="checkbox">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} aria-invalid={!!errors.acceptTerms} />
        <span>I have read the <a href="/policies/privacy" target="_blank">privacy policy</a> and agree to be contacted about this brief.</span>
      </label>
      {errors.acceptTerms && <p className="field-error">{errors.acceptTerms}</p>}
      <div className="cluster">
        <button className="btn" type="submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" /> Sending…</> : 'Send brief'}</button>
        <span className="small muted">Sending a brief does not book or reserve a date.</span>
      </div>
    </form>
  );
}
