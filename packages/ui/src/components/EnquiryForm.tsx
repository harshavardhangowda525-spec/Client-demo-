'use client';

import { useState, type FormEvent } from 'react';
import { createEnquirySchema } from '@studio/core/schemas';
import { api, fieldErrors, rememberAccessToken } from '../lib/api';
import type { Category, Me, PublicLocation, PublicService } from '../lib/types';
import { TextField } from './BookingFlow';

export function EnquiryForm({ categories, services, locations, me, initialCategory }: {
  categories: Category[];
  services: PublicService[];
  locations: PublicLocation[];
  me: Me | null;
  initialCategory?: string;
}) {
  const initialCat = categories.find((c) => c.slug === initialCategory);
  const [form, setForm] = useState({
    categoryId: initialCat?.id ?? '',
    eventType: initialCat?.name ?? '',
    preferredDate: '',
    alternateDate: '',
    locationId: '',
    venueDetails: '',
    expectedAttendance: '',
    serviceIds: [] as string[],
    budgetMin: '',
    budgetMax: '',
    setupRequirements: '',
    notes: '',
    name: me?.profile.fullName ?? '',
    email: me?.profile.email ?? '',
    phone: me?.profile.phone ?? '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string } | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const rupeesToMinor = (v: string) => (v.trim() === '' ? null : Math.round(Number(v.replace(/[,\s]/g, '')) * 100));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    const payload = {
      categoryId: form.categoryId || null,
      eventType: form.eventType,
      preferredDate: form.preferredDate,
      alternateDate: form.alternateDate || null,
      locationId: form.locationId || null,
      venueDetails: form.venueDetails || undefined,
      expectedAttendance: form.expectedAttendance,
      serviceIds: form.serviceIds,
      budgetMinMinor: rupeesToMinor(form.budgetMin),
      budgetMaxMinor: rupeesToMinor(form.budgetMax),
      setupRequirements: form.setupRequirements || undefined,
      notes: form.notes || undefined,
      contact: { name: form.name, email: form.email, phone: form.phone || undefined },
      acceptTerms: form.acceptTerms,
    };
    const parsed = createEnquirySchema.safeParse(payload);
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) e2[i.path.join('.')] ??= i.message;
      if (Number.isNaN(payload.budgetMinMinor)) e2.budgetMinMinor = 'Enter a number';
      setErrors(e2);
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await api<{ reference: string; accessToken: string }>('/api/v1/enquiries', { body: payload });
    setBusy(false);
    if (res.ok) {
      rememberAccessToken(res.data.reference, res.data.accessToken);
      setDone({ reference: res.data.reference });
      window.scrollTo({ top: 0 });
    } else {
      setErrors(fieldErrors(res.error));
      setServerError(res.error.message);
    }
  }

  if (done) {
    return (
      <div className="card stack" role="status">
        <p className="eyebrow">Enquiry received</p>
        <h2>Thank you. Your reference is <span className="mono">{done.reference}</span></h2>
        <p>
          <strong>This is not a booking yet.</strong> The team will review your enquiry and prepare a tailored proposal. Your date is only reserved once you accept a quotation and the team confirms it.
        </p>
        <div className="cluster">
          <a className="btn" href={`/enquiry-status?ref=${done.reference}`}>View enquiry status</a>
          <a className="btn btn--ghost" href="/">Back to home</a>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {serverError && <div className="alert alert--danger" role="alert">{serverError}</div>}
      <fieldset className="stack">
        <legend className="eyebrow">The occasion</legend>
        <div className="form-row form-row--2">
          <div className="field">
            <label htmlFor="category">Event category</label>
            <select id="category" className="select" value={form.categoryId} onChange={(e) => {
              const c = categories.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, categoryId: e.target.value, eventType: f.eventType || c?.name || '' }));
            }}>
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <TextField id="eventType" label="Event type" value={form.eventType} onChange={set('eventType')} error={errors.eventType} hint="For example: annual offsite, 40th birthday dinner" required />
        </div>
        <div className="form-row form-row--3">
          <TextField id="preferredDate" label="Preferred date" type="date" value={form.preferredDate} onChange={set('preferredDate')} error={errors.preferredDate} required />
          <TextField id="alternateDate" label="Alternate date" type="date" value={form.alternateDate} onChange={set('alternateDate')} error={errors.alternateDate} />
          <TextField id="attendance" label="Expected guests" inputMode="numeric" value={form.expectedAttendance} onChange={set('expectedAttendance')} error={errors.expectedAttendance} required />
        </div>
        <div className="form-row form-row--2">
          <div className="field">
            <label htmlFor="venue">Venue or location</label>
            <select id="venue" className="select" value={form.locationId} onChange={(e) => set('locationId')(e.target.value)}>
              <option value="">Not decided / my own venue</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}
            </select>
          </div>
          <TextField id="venueDetails" label="Venue details (optional)" value={form.venueDetails} onChange={set('venueDetails')} hint="Name or area of your own venue, if any" />
        </div>
      </fieldset>

      <fieldset className="stack">
        <legend className="eyebrow">Services</legend>
        <div className="options options--2">
          {services.map((s) => (
            <label key={s.id} className="option">
              <input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={(e) => setForm((f) => ({ ...f, serviceIds: e.target.checked ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id) }))} />
              <span className="option__title">{s.name}</span>
              <span className="option__meta">{s.summary}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="stack">
        <legend className="eyebrow">Budget (optional)</legend>
        <div className="form-row form-row--2">
          <TextField id="budgetMin" label="Minimum (₹)" inputMode="numeric" value={form.budgetMin} onChange={set('budgetMin')} error={errors.budgetMinMinor} />
          <TextField id="budgetMax" label="Maximum (₹)" inputMode="numeric" value={form.budgetMax} onChange={set('budgetMax')} error={errors.budgetMaxMinor} />
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="setup">Set-up requirements</label>
        <textarea id="setup" className="textarea" value={form.setupRequirements} onChange={(e) => set('setupRequirements')(e.target.value)} placeholder="Staging, AV, seating, catering, accessibility needs…" maxLength={3000} />
      </div>
      <div className="field">
        <label htmlFor="notes">Anything else we should know?</label>
        <textarea id="notes" className="textarea" value={form.notes} onChange={(e) => set('notes')(e.target.value)} maxLength={3000} />
      </div>

      <fieldset className="stack">
        <legend className="eyebrow">Your details</legend>
        <div className="form-row form-row--3">
          <TextField id="e-name" label="Full name" autoComplete="name" value={form.name} onChange={set('name')} error={errors['contact.name']} required />
          <TextField id="e-email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors['contact.email']} required readOnly={!!me} />
          <TextField id="e-phone" label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors['contact.phone']} />
        </div>
      </fieldset>

      <label className="checkbox">
        <input type="checkbox" checked={form.acceptTerms} onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))} aria-invalid={!!errors.acceptTerms} />
        <span>I understand this is an enquiry, not a booking, and I have read the <a href="/privacy" target="_blank">privacy notice</a>.</span>
      </label>
      {errors.acceptTerms && <p className="field-error">{errors.acceptTerms}</p>}
      <div>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send enquiry'}</button>
      </div>
    </form>
  );
}
