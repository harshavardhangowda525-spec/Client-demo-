'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { formatCalendarDate, formatDateTime, formatMoney, PriceBreakdown, type Catalog } from '@studio/ui';
import { errorText, mutate, useAdminData, useCan } from '../../../lib/client';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Line { description: string; quantity: string; unitPrice: string }

export default function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const { data: e, error, reload } = useAdminData<any>(`/api/v1/admin/enquiries/${id}`);
  const { data: staff } = useAdminData<any[]>('/api/v1/admin/staff');
  // Enquiries belong to one website (events, or photo/podcast briefs from the studio site).
  const { data: catalog } = useAdminData<Catalog & { services: any[] }>(e ? `/api/v1/sites/${e.brand}/catalog` : null);
  const { data: locations } = useAdminData<any[]>(e ? `/api/v1/sites/${e.brand}/locations` : null);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: '1', unitPrice: '' }]);
  const [discount, setDiscount] = useState('0');
  const [validUntil, setValidUntil] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [terms, setTerms] = useState('');
  const [followUp, setFollowUp] = useState({ note: '', dueAt: '' });
  const [respond, setRespond] = useState('');
  const [convert, setConvert] = useState({ serviceId: '', locationId: '', date: '', startTime: '10:00', durationMin: '480' });

  const draft = e?.quotations.find((q: any) => q.status === 'DRAFT');
  useEffect(() => {
    if (draft) {
      setLines(draft.lines.map((l: any) => ({ description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPriceMinor / 100) })));
      setDiscount(String(draft.discountMinor / 100));
      setCustomerMessage(draft.customerMessage ?? '');
      setTerms(draft.terms ?? '');
    }
  }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (e) setConvert((c) => ({ ...c, serviceId: c.serviceId || e.services[0]?.service.id || '', locationId: c.locationId || e.location?.id || '', date: c.date || e.preferredDate.slice(0, 10) }));
  }, [e]);

  if (error) return <div className="alert alert--danger">{error.message}</div>;
  if (!e) return <p className="muted">Loading…</p>;

  async function run(fn: () => Promise<any>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setMsg({ tone: 'success', text: success });
      await reload();
    } else setMsg({ tone: 'danger', text: errorText(res.error) ?? 'Failed' });
    return res;
  }

  const manage = can('enquiries.manage');
  const sent = e.quotations.find((q: any) => q.status === 'SENT');
  const accepted = e.quotations.find((q: any) => q.status === 'ACCEPTED');
  const requested = new Set(e.services.map((x: any) => x.service.id));
  const quoteServices = (catalog?.services ?? []).filter((s: any) => s.bookingMode === 'ENQUIRY' || requested.has(s.id));
  const isEvent = e.brand === 'EVENTS';
  const convLocations = (locations ?? []).filter((l: any) => quoteServices.find((s: any) => s.id === convert.serviceId)?.locationIds.includes(l.id));

  return (
    <div className="stack-lg">
      <div>
        <p className="small"><Link href="/enquiries">← Enquiries</Link></p>
        <h1 className="mono" style={{ marginBottom: 'var(--space-2)' }}>{e.reference}</h1>
        <div className="cluster"><span className="badge">{e.brand.toLowerCase()}</span>{e.sourceSite === 'STUDIO' && <span className="badge badge--accent">via studio site</span>}<span className="badge">{e.status.replace('_', ' ').toLowerCase()}</span>{e.isDemo && <span className="badge badge--demo">Demo record</span>}{e.booking && <Link className="badge badge--success" href={`/bookings/${e.booking.id}`}>Booking {e.booking.reference}</Link>}</div>
      </div>
      {msg && <div className={`alert alert--${msg.tone}`} role="status">{msg.text}</div>}
      <div className="cols">
        <div>
          <section className="panel">
            <h2>Enquiry</h2>
            <dl className="dl">
              <dt>{isEvent ? 'Event' : 'Project'}</dt><dd>{e.eventType}{e.category ? ` · ${e.category.name}` : ''}</dd>
              {e.companyName && (<><dt>Company</dt><dd>{e.companyName}</dd></>)}
              <dt>Preferred date</dt><dd>{formatCalendarDate(e.preferredDate.slice(0, 10))}</dd>
              {e.alternateDate && (<><dt>Alternate</dt><dd>{formatCalendarDate(e.alternateDate.slice(0, 10))}</dd></>)}
              <dt>{isEvent ? 'Guests' : 'People'}</dt><dd>{e.expectedAttendance}</dd>
              {e.expectedDuration && (<><dt>Duration</dt><dd>{e.expectedDuration}</dd></>)}
              {e.deliverables != null && (<><dt>Deliverables</dt><dd>{e.deliverables}</dd></>)}
              <dt>{isEvent ? 'Venue' : 'Location'}</dt><dd>{e.location?.name ?? '—'}{e.venueDetails ? ` · ${e.venueDetails}` : ''}</dd>
              <dt>Services</dt><dd>{e.services.map((s: any) => s.service.name).join(', ') || '—'}</dd>
              <dt>Budget</dt><dd>{e.budgetMinMinor != null || e.budgetMaxMinor != null ? `${e.budgetMinMinor != null ? formatMoney(e.budgetMinMinor) : '…'} – ${e.budgetMaxMinor != null ? formatMoney(e.budgetMaxMinor) : '…'}` : 'Not given'}</dd>
              <dt>Set-up</dt><dd>{e.setupRequirements ?? '—'}</dd>
              <dt>Notes</dt><dd>{e.notes ?? '—'}</dd>
              <dt>Contact</dt><dd><Link href={`/customers/${e.customer.id}`}>{e.contactName}</Link> · {e.contactEmail}{e.contactPhone ? ` · ${e.contactPhone}` : ''}</dd>
              <dt>Received</dt><dd>{formatDateTime(e.createdAt, 'Asia/Kolkata')}</dd>
              {e.attachments?.length > 0 && (<><dt>Attachments</dt><dd><ul style={{ margin: 0, paddingLeft: '1.1em' }}>{e.attachments.map((a: any) => (
                <li key={a.id}><a href={`/api/v1/admin/attachments/${a.id}`} download>{a.fileName}</a> <span className="small muted">({Math.max(1, Math.round(a.sizeBytes / 1024))} KB · {a.mimeType})</span></li>
              ))}</ul><p className="small muted" style={{ margin: 0 }}>Customer uploads. Files are type-checked on upload; open them with care.</p></dd></>)}
            </dl>
          </section>

          {e.quotations.length > 0 && (
            <section className="panel">
              <h2>Quotations</h2>
              {e.quotations.map((q: any) => (
                <div key={q.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                  <p><strong className="mono">{q.reference}</strong> v{q.version} · <span className="badge">{q.status.toLowerCase()}</span> <span className="small muted">valid until {formatDateTime(q.validUntil, 'Asia/Kolkata')}{q.createdBy ? ` · by ${q.createdBy.name}` : ''}</span></p>
                  <PriceBreakdown lines={(q.priceBreakdown?.lines ?? q.lines).map((l: any) => ({ kind: l.kind ?? 'QUOTE_LINE', description: l.quantity !== 1 ? `${l.description} (${l.quantity} × ${formatMoney(l.unitPriceMinor)})` : l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: l.totalMinor }))} totalMinor={q.totalMinor} depositMinor={q.depositMinor} />
                  {q.status === 'DRAFT' && manage && <button className="btn btn--sm" style={{ marginTop: 'var(--space-3)' }} disabled={busy} onClick={() => run(() => mutate(`/api/v1/admin/quotations/${q.id}/send`, 'POST'), 'Quotation sent to the customer.')}>Send to customer</button>}
                </div>
              ))}
            </section>
          )}

          {manage && !['CONVERTED', 'CLOSED'].includes(e.status) && (
            <section className="panel">
              <h2>{draft ? `Edit draft ${draft.reference}` : sent ? 'Prepare a revised quotation (supersedes the sent one)' : 'Prepare quotation'}</h2>
              <p className="small muted">Totals, tax and deposit are calculated on the server from these lines and the configured pricing settings.</p>
              <form className="stack" onSubmit={(ev) => {
                ev.preventDefault();
                run(() => mutate(`/api/v1/admin/enquiries/${e.id}/quotations`, 'POST', {
                  lines: lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPriceMinor: Math.round(Number(l.unitPrice) * 100) })),
                  discountMinor: Math.round(Number(discount || 0) * 100),
                  validUntil: validUntil || undefined,
                  customerMessage: customerMessage || undefined,
                  terms: terms || undefined,
                }), 'Draft quotation saved.');
              }}>
                <table className="table">
                  <thead><tr><th>Description</th><th style={{ width: 90 }}>Qty</th><th style={{ width: 140 }}>Unit price (₹)</th><th /></tr></thead>
                  <tbody>{lines.map((l, i) => (
                    <tr key={i}>
                      <td><input aria-label={`Line ${i + 1} description`} className="input" value={l.description} onChange={(ev) => setLines(lines.map((x, j) => j === i ? { ...x, description: ev.target.value } : x))} /></td>
                      <td><input aria-label={`Line ${i + 1} quantity`} className="input" inputMode="decimal" value={l.quantity} onChange={(ev) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: ev.target.value } : x))} /></td>
                      <td><input aria-label={`Line ${i + 1} unit price`} className="input" inputMode="decimal" value={l.unitPrice} onChange={(ev) => setLines(lines.map((x, j) => j === i ? { ...x, unitPrice: ev.target.value } : x))} /></td>
                      <td><button type="button" className="btn btn--ghost btn--sm" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                <div><button type="button" className="btn btn--ghost btn--sm" onClick={() => setLines([...lines, { description: '', quantity: '1', unitPrice: '' }])}>Add line</button></div>
                <div className="form-row form-row--3">
                  <div className="field"><label htmlFor="disc">Discount (₹)</label><input id="disc" className="input" value={discount} onChange={(ev) => setDiscount(ev.target.value)} /></div>
                  <div className="field"><label htmlFor="vu">Valid until</label><input id="vu" type="date" className="input" value={validUntil} onChange={(ev) => setValidUntil(ev.target.value)} /></div>
                </div>
                <div className="field"><label htmlFor="cm">Message to customer</label><textarea id="cm" className="textarea" style={{ minHeight: 70 }} value={customerMessage} onChange={(ev) => setCustomerMessage(ev.target.value)} /></div>
                <div className="field"><label htmlFor="tm">Terms</label><textarea id="tm" className="textarea" style={{ minHeight: 70 }} value={terms} onChange={(ev) => setTerms(ev.target.value)} /></div>
                <div><button className="btn" type="submit" disabled={busy}>Save draft</button></div>
              </form>
            </section>
          )}

          {manage && sent && (
            <section className="panel">
              <h2>Record the customer&rsquo;s response</h2>
              <p className="small muted">Customers can accept online. Use this only when they respond by phone or email; a note is required and recorded in the audit log.</p>
              <div className="field"><label htmlFor="resp">Note</label><input id="resp" className="input" value={respond} onChange={(ev) => setRespond(ev.target.value)} placeholder="e.g. accepted by phone on 24 Oct" /></div>
              <div className="cluster" style={{ marginTop: 'var(--space-3)' }}>
                <button className="btn" disabled={busy} onClick={() => run(() => mutate(`/api/v1/admin/quotations/${sent.id}/respond`, 'POST', { decision: 'ACCEPT', reason: respond }), 'Acceptance recorded.')}>Record acceptance</button>
                <button className="btn btn--danger" disabled={busy} onClick={() => run(() => mutate(`/api/v1/admin/quotations/${sent.id}/respond`, 'POST', { decision: 'DECLINE', reason: respond }), 'Decline recorded.')}>Record decline</button>
              </div>
            </section>
          )}

          {accepted && !e.booking && can('bookings.manage') && (
            <section className="panel">
              <h2>Convert to booking</h2>
              <p className="small muted">The venue&rsquo;s availability is verified with the booking engine. The price comes from accepted quotation {accepted.reference}.</p>
              <form className="toolbar" onSubmit={(ev) => { ev.preventDefault(); run(() => mutate(`/api/v1/admin/quotations/${accepted.id}/convert`, 'POST', { ...convert, durationMin: Number(convert.durationMin) }), 'Booking created from the quotation.'); }}>
                <div className="field"><label htmlFor="cs">Service</label><select id="cs" className="select" value={convert.serviceId} onChange={(ev) => setConvert({ ...convert, serviceId: ev.target.value })}>{quoteServices.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div className="field"><label htmlFor="cl">Venue</label><select id="cl" className="select" value={convert.locationId} onChange={(ev) => setConvert({ ...convert, locationId: ev.target.value })}><option value="">Choose…</option>{convLocations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                <div className="field"><label htmlFor="cd">Date</label><input id="cd" type="date" className="input" value={convert.date} onChange={(ev) => setConvert({ ...convert, date: ev.target.value })} /></div>
                <div className="field"><label htmlFor="ct">Start</label><input id="ct" type="time" className="input" value={convert.startTime} onChange={(ev) => setConvert({ ...convert, startTime: ev.target.value })} /></div>
                <div className="field"><label htmlFor="cdur">Duration (min)</label><input id="cdur" className="input" inputMode="numeric" value={convert.durationMin} onChange={(ev) => setConvert({ ...convert, durationMin: ev.target.value })} /></div>
                <button className="btn" type="submit" disabled={busy}>Create booking</button>
              </form>
            </section>
          )}
        </div>

        <div>
          {manage && (
            <section className="panel">
              <h2>Workflow</h2>
              <div className="field"><label htmlFor="as">Assigned to</label>
                <select id="as" className="select" value={e.assignedTo?.id ?? ''} onChange={(ev) => run(() => mutate(`/api/v1/admin/enquiries/${e.id}`, 'PATCH', { assignedToId: ev.target.value || null }), 'Assignee updated.')}>
                  <option value="">Unassigned</option>{(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div className="cluster" style={{ marginTop: 'var(--space-4)' }}>
                {e.status === 'SUBMITTED' && <button className="btn btn--sm" onClick={() => run(() => mutate(`/api/v1/admin/enquiries/${e.id}`, 'PATCH', { status: 'UNDER_REVIEW' }), 'Marked under review.')}>Start review</button>}
                {['SUBMITTED', 'UNDER_REVIEW', 'QUOTED'].includes(e.status) && <button className="btn btn--danger btn--sm" onClick={() => run(() => mutate(`/api/v1/admin/enquiries/${e.id}`, 'PATCH', { status: 'DECLINED' }), 'Enquiry declined.')}>Decline enquiry</button>}
                {!['CONVERTED', 'CLOSED'].includes(e.status) && <button className="btn btn--ghost btn--sm" onClick={() => run(() => mutate(`/api/v1/admin/enquiries/${e.id}`, 'PATCH', { status: 'CLOSED' }), 'Enquiry closed.')}>Close</button>}
              </div>
            </section>
          )}
          <section className="panel">
            <h2>Follow-ups</h2>
            {manage && (
              <form className="stack" onSubmit={(ev) => { ev.preventDefault(); run(async () => { const r = await mutate(`/api/v1/admin/enquiries/${e.id}/follow-ups`, 'POST', { note: followUp.note, dueAt: followUp.dueAt ? new Date(followUp.dueAt).toISOString() : null }); if (r.ok) setFollowUp({ note: '', dueAt: '' }); return r; }, 'Follow-up added.'); }}>
                <textarea aria-label="Follow-up note" className="textarea" style={{ minHeight: 60 }} value={followUp.note} onChange={(ev) => setFollowUp({ ...followUp, note: ev.target.value })} placeholder="Call back about AV needs…" required />
                <label className="small">Due<input type="datetime-local" className="input" value={followUp.dueAt} onChange={(ev) => setFollowUp({ ...followUp, dueAt: ev.target.value })} /></label>
                <div><button className="btn btn--sm" type="submit" disabled={busy}>Add follow-up</button></div>
              </form>
            )}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {e.followUps.map((f: any) => (
                <li key={f.id} style={{ borderTop: '1px solid var(--border)', padding: 'var(--space-3) 0' }}>
                  <div className="small muted">{f.author?.name ?? 'Staff'} · {formatDateTime(f.createdAt, 'Asia/Kolkata')}{f.dueAt ? ` · due ${formatDateTime(f.dueAt, 'Asia/Kolkata')}` : ''}</div>
                  <div style={{ textDecoration: f.completedAt ? 'line-through' : undefined }}>{f.note}</div>
                  {!f.completedAt && manage && <button className="btn btn--ghost btn--sm" onClick={() => run(() => mutate(`/api/v1/admin/follow-ups/${f.id}/complete`, 'POST'), 'Follow-up completed.')}>Mark done</button>}
                </li>
              ))}
              {!e.followUps.length && <li className="small muted">No follow-ups yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
