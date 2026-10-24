export type TemplateKey =
  | 'booking.received'
  | 'booking.confirmed'
  | 'booking.status_changed'
  | 'payment.received'
  | 'payment.failed'
  | 'enquiry.received'
  | 'quotation.sent'
  | 'contact.received'
  | 'auth.password_reset'
  | 'auth.verify_email';

export interface RenderedMessage {
  subject: string;
  text: string;
}

type Data = Record<string, string | number | undefined | null>;

const t = (s: string | number | undefined | null) => (s === undefined || s === null ? '' : String(s));

export function renderTemplate(key: TemplateKey, d: Data): RenderedMessage {
  switch (key) {
    case 'booking.received':
      return {
        subject: `Booking request ${t(d.reference)} received`,
        text: `Hello ${t(d.name)},\n\nWe have received your booking request ${t(d.reference)} for ${t(d.service)} on ${t(d.when)}.\nCurrent status: ${t(d.status)}.\n\n${t(d.nextStep)}\n\nCheck your booking: ${t(d.link)}\n\n${t(d.brandName)}`,
      };
    case 'booking.confirmed':
      return {
        subject: `Booking ${t(d.reference)} confirmed`,
        text: `Hello ${t(d.name)},\n\nYour booking ${t(d.reference)} for ${t(d.service)} on ${t(d.when)} is confirmed.\n\n${t(d.brandName)}`,
      };
    case 'booking.status_changed':
      return {
        subject: `Booking ${t(d.reference)}: ${t(d.status)}`,
        text: `Hello ${t(d.name)},\n\nThe status of booking ${t(d.reference)} is now: ${t(d.status)}.\n${t(d.reason)}\n\n${t(d.brandName)}`,
      };
    case 'payment.received':
      return {
        subject: `Payment recorded for ${t(d.reference)}`,
        text: `Hello ${t(d.name)},\n\nA payment of ${t(d.amount)} has been recorded for booking ${t(d.reference)}.${d.simulated ? '\n\nTHIS WAS A SIMULATED DEMO PAYMENT. NO MONEY WAS TAKEN.' : ''}\n\n${t(d.brandName)}`,
      };
    case 'payment.failed':
      return {
        subject: `Payment not completed for ${t(d.reference)}`,
        text: `Hello ${t(d.name)},\n\nThe payment for booking ${t(d.reference)} did not complete. You can try again from your booking page.\n\n${t(d.brandName)}`,
      };
    case 'enquiry.received':
      return {
        subject: `Enquiry ${t(d.reference)} received`,
        text: `Hello ${t(d.name)},\n\nThank you for your enquiry ${t(d.reference)} about a ${t(d.eventType)} on ${t(d.date)}.\nThis is not a booking yet. Our team will review it and prepare a proposal.\n\n${t(d.brandName)}`,
      };
    case 'quotation.sent':
      return {
        subject: `Your proposal ${t(d.reference)}`,
        text: `Hello ${t(d.name)},\n\nYour proposal ${t(d.reference)} totals ${t(d.total)} and is valid until ${t(d.validUntil)}.\nReview it here: ${t(d.link)}\n\n${t(d.brandName)}`,
      };
    case 'contact.received':
      return {
        subject: `We received your message`,
        text: `Hello ${t(d.name)},\n\nThank you for contacting ${t(d.brandName)}. The team will reply as soon as possible.`,
      };
    case 'auth.password_reset':
      return {
        subject: 'Reset your password',
        text: `Hello ${t(d.name)},\n\nUse this link to reset your password: ${t(d.link)}\nIf you did not request this, you can ignore this message.`,
      };
    case 'auth.verify_email':
      return {
        subject: 'Verify your email address',
        text: `Hello ${t(d.name)},\n\nConfirm your email address: ${t(d.link)}`,
      };
  }
}
