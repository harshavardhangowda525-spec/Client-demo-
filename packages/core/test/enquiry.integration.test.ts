import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@studio/db';
import { convertQuotationToBooking, createEnquiry, getEnquiryForViewer, respondToQuotation, saveQuotationDraft, sendQuotation, updateEnquiry } from '../src/enquiry/service';
import { actor, futureWeekday, guest, ids, resetDatabase } from './helpers';

let I: Awaited<ReturnType<typeof ids>>;
beforeAll(async () => {
  await resetDatabase();
  I = await ids();
});

const enquiryInput = (over: Record<string, unknown> = {}) => ({
  eventType: 'Team offsite',
  preferredDate: futureWeekday(40),
  expectedAttendance: 80,
  serviceIds: [I.corporateEvents],
  locationId: I.garden,
  contact: guest('planner@test.example'),
  acceptTerms: true,
  ...over,
});

describe('event enquiries', () => {
  it('creates an enquiry without creating a booking', async () => {
    const before = await prisma.booking.count();
    const { enquiry, accessToken } = await createEnquiry(enquiryInput(), null);
    expect(enquiry.status).toBe('SUBMITTED');
    expect(enquiry.reference).toMatch(/^EQ-/);
    expect(await prisma.booking.count()).toBe(before);
    await expect(getEnquiryForViewer(enquiry.reference, { actor: null, accessToken })).resolves.toBeDefined();
    await expect(getEnquiryForViewer(enquiry.reference, { actor: null, accessToken: 'nope' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('validates enquiry input', async () => {
    await expect(createEnquiry(enquiryInput({ preferredDate: '2020-01-01' }), null)).rejects.toThrow(/future/);
    await expect(createEnquiry(enquiryInput({ expectedAttendance: 0 }), null)).rejects.toThrow();
    await expect(createEnquiry(enquiryInput({ budgetMinMinor: 500, budgetMaxMinor: 100 }), null)).rejects.toThrow(/Maximum budget/);
    await expect(createEnquiry(enquiryInput({ serviceIds: [I.portrait] }), null)).rejects.toThrow(/unavailable/);
  });

  it('runs the quotation workflow end to end and converts into a booking', async () => {
    const admin = await actor('admin@demo.example');
    const { enquiry, accessToken } = await createEnquiry(enquiryInput(), null);

    const draft = await saveQuotationDraft(enquiry.id, {
      lines: [
        { description: 'Planning', quantity: 1, unitPriceMinor: 1_000_000, totalMinor: 1 },
        { description: 'Catering', quantity: 80, unitPriceMinor: 150_000 },
      ],
      discountMinor: 0,
    }, admin);
    // Server computes totals (client-supplied totalMinor is ignored): 10,000 + 120,000 = 130,000 INR + 18%.
    expect(draft.subtotalMinor).toBe(13_000_000);
    expect(draft.totalMinor).toBe(15_340_000);
    expect(draft.status).toBe('DRAFT');

    // Cannot convert before acceptance.
    await expect(convertQuotationToBooking(draft.id, { serviceId: I.corporateEvents, locationId: I.garden, date: futureWeekday(40), startTime: '10:00', durationMin: 480 }, admin)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    await sendQuotation(draft.id, admin);
    expect((await prisma.eventEnquiry.findUniqueOrThrow({ where: { id: enquiry.id } })).status).toBe('QUOTED');
    // Customer can see the sent proposal through their token.
    const view = await getEnquiryForViewer(enquiry.reference, { actor: null, accessToken });
    expect(view.quotations).toHaveLength(1);

    await respondToQuotation(draft.id, 'ACCEPT', null);
    expect((await prisma.eventEnquiry.findUniqueOrThrow({ where: { id: enquiry.id } })).status).toBe('ACCEPTED');

    const { booking } = await convertQuotationToBooking(draft.id, { serviceId: I.corporateEvents, locationId: I.garden, date: futureWeekday(40), startTime: '10:00', durationMin: 480 }, admin);
    expect(booking.status).toBe('AWAITING_PAYMENT');
    expect(booking.totalMinor).toBe(15_340_000);
    expect(booking.quotationId).toBe(draft.id);
    expect((await prisma.eventEnquiry.findUniqueOrThrow({ where: { id: enquiry.id } })).status).toBe('CONVERTED');

    // Converting twice is refused.
    await expect(convertQuotationToBooking(draft.id, { serviceId: I.corporateEvents, locationId: I.garden, date: futureWeekday(41), startTime: '10:00', durationMin: 480 }, admin)).rejects.toBeDefined();
  });

  it('venue conflicts are prevented for converted events too', async () => {
    const admin = await actor('admin@demo.example');
    const date = futureWeekday(50);
    const mk = async () => {
      const { enquiry } = await createEnquiry(enquiryInput({ preferredDate: date }), null);
      const q = await saveQuotationDraft(enquiry.id, { lines: [{ description: 'Event', quantity: 1, unitPriceMinor: 100_000 }] }, admin);
      await sendQuotation(q.id, admin);
      await respondToQuotation(q.id, 'ACCEPT', admin, { onBehalf: true, reason: 'Accepted by phone' });
      return q;
    };
    const q1 = await mk();
    const q2 = await mk();
    await convertQuotationToBooking(q1.id, { serviceId: I.corporateEvents, locationId: I.garden, date, startTime: '12:00', durationMin: 360 }, admin);
    await expect(convertQuotationToBooking(q2.id, { serviceId: I.corporateEvents, locationId: I.garden, date, startTime: '14:00', durationMin: 240 }, admin)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('staff must give a reason to record acceptance on behalf of the customer; expired proposals cannot be accepted', async () => {
    const admin = await actor('admin@demo.example');
    const { enquiry } = await createEnquiry(enquiryInput(), null);
    const q = await saveQuotationDraft(enquiry.id, { lines: [{ description: 'Event', quantity: 1, unitPriceMinor: 100_000 }] }, admin);
    await sendQuotation(q.id, admin);
    await expect(respondToQuotation(q.id, 'ACCEPT', admin, { onBehalf: true })).rejects.toThrow(/note/);
    await expect(respondToQuotation(q.id, 'ACCEPT', null, {}, {}, prisma, new Date(Date.now() + 365 * 86_400_000))).rejects.toThrow(/expired/);
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('EXPIRED');
  });

  it('a new draft supersedes an open proposal; status changes follow the workflow', async () => {
    const admin = await actor('admin@demo.example');
    const { enquiry } = await createEnquiry(enquiryInput(), null);
    const q1 = await saveQuotationDraft(enquiry.id, { lines: [{ description: 'Option A', quantity: 1, unitPriceMinor: 100 }] }, admin);
    await sendQuotation(q1.id, admin);
    const q2 = await saveQuotationDraft(enquiry.id, { lines: [{ description: 'Option B', quantity: 1, unitPriceMinor: 200 }] }, admin);
    expect(q2.version).toBe(2);
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id: q1.id } })).status).toBe('SUPERSEDED');
    await expect(updateEnquiry(enquiry.id, { status: 'CONVERTED' }, admin)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await expect(updateEnquiry(enquiry.id, { status: 'CLOSED' }, admin)).resolves.toBeDefined();
  });
});
