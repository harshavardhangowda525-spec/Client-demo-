'use client';

import { useState, type FormEvent } from 'react';
import { contactMessageSchema } from '@studio/core/schemas';
import { api, fieldErrors } from '../lib/api';
import type { Brand } from '../lib/types';
import { TextField } from './BookingFlow';

export function ContactForm({ brand }: { brand: Brand }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = { brand, ...form, phone: form.phone || undefined };
    const parsed = contactMessageSchema.safeParse(payload);
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) e2[i.path.join('.')] ??= i.message;
      setErrors(e2);
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await api('/api/v1/contact', { body: payload });
    setBusy(false);
    if (res.ok) setSent(true);
    else {
      setErrors(fieldErrors(res.error));
      setServerError(res.error.message);
    }
  }

  if (sent) {
    return (
      <div className="alert alert--success" role="status">
        <strong>Message received</strong>
        <p>Thank you. Your message has been saved and the team will reply by email. (In this demo, email delivery is shown as a preview in the admin panel unless an email provider is configured.)</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {serverError && <div className="alert alert--danger" role="alert">{serverError}</div>}
      <div className="form-row form-row--2">
        <TextField id="c-name" label="Name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} required />
        <TextField id="c-email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} required />
      </div>
      <div className="form-row form-row--2">
        <TextField id="c-phone" label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <TextField id="c-subject" label="Subject" value={form.subject} onChange={set('subject')} error={errors.subject} required />
      </div>
      <div className="field">
        <label htmlFor="c-message">Message <span aria-hidden="true">*</span></label>
        <textarea id="c-message" className="textarea" value={form.message} onChange={(e) => set('message')(e.target.value)} aria-invalid={!!errors.message} maxLength={5000} />
        {errors.message && <p className="field-error">{errors.message}</p>}
      </div>
      <div><button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button></div>
    </form>
  );
}
