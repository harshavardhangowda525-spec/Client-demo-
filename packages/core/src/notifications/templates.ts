// Default notification templates. Administrators can override subject and body
// per template (NotificationTemplate table); {{variable}} placeholders are
// filled in at send time. Unknown placeholders render as empty text.

export type TemplateKey =
  | 'booking.received'
  | 'booking.confirmed'
  | 'booking.status_changed'
  | 'booking.reminder'
  | 'reschedule.requested'
  | 'reschedule.decided'
  | 'payment.received'
  | 'payment.failed'
  | 'enquiry.received'
  | 'quotation.sent'
  | 'contact.received'
  | 'staff.new_booking'
  | 'staff.new_enquiry'
  | 'auth.password_reset'
  | 'auth.verify_email';

export interface TemplateDefinition {
  key: TemplateKey;
  description: string;
  variables: string[];
  subject: string;
  body: string;
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    key: 'booking.received',
    description: 'Sent to the customer when a booking or booking request is created',
    variables: ['name', 'reference', 'service', 'when', 'status', 'nextStep', 'link', 'brandName'],
    subject: 'Booking request {{reference}} received',
    body: 'Hello {{name}},\n\nWe have received your booking request {{reference}} for {{service}} on {{when}}.\nCurrent status: {{status}}.\n\n{{nextStep}}\n\nCheck your booking: {{link}}\n\n{{brandName}}',
  },
  {
    key: 'booking.confirmed',
    description: 'Sent when a booking becomes confirmed',
    variables: ['name', 'reference', 'service', 'when', 'link', 'brandName'],
    subject: 'Booking {{reference}} confirmed',
    body: 'Hello {{name}},\n\nYour booking {{reference}} for {{service}} on {{when}} is confirmed.\n\nView your booking: {{link}}\n\n{{brandName}}',
  },
  {
    key: 'booking.status_changed',
    description: 'Sent on other status changes (rejection, cancellation, reschedule, review)',
    variables: ['name', 'reference', 'service', 'when', 'status', 'reason', 'link', 'brandName'],
    subject: 'Booking {{reference}}: {{status}}',
    body: 'Hello {{name}},\n\nThe status of booking {{reference}} ({{service}}, {{when}}) is now: {{status}}.\n{{reason}}\n\nView your booking: {{link}}\n\n{{brandName}}',
  },
  {
    key: 'booking.reminder',
    description: 'Reminder before an upcoming confirmed session (respects customer preferences)',
    variables: ['name', 'reference', 'service', 'when', 'location', 'link', 'brandName'],
    subject: 'Reminder: {{service}} on {{when}}',
    body: 'Hello {{name}},\n\nThis is a reminder of your session {{reference}}: {{service}} on {{when}} at {{location}}.\n\nDetails: {{link}}\n\n{{brandName}}',
  },
  {
    key: 'reschedule.requested',
    description: 'Sent to the customer when their reschedule request is received',
    variables: ['name', 'reference', 'requested', 'link', 'brandName'],
    subject: 'Reschedule request for {{reference}} received',
    body: 'Hello {{name}},\n\nWe received your request to move booking {{reference}} to {{requested}}. Your original time stays reserved until the team confirms the change.\n\n{{link}}\n\n{{brandName}}',
  },
  {
    key: 'reschedule.decided',
    description: 'Sent when staff approve or decline a reschedule request',
    variables: ['name', 'reference', 'decision', 'when', 'note', 'link', 'brandName'],
    subject: 'Reschedule request for {{reference}}: {{decision}}',
    body: 'Hello {{name}},\n\nYour reschedule request for booking {{reference}} was {{decision}}. Your session time: {{when}}.\n{{note}}\n\n{{link}}\n\n{{brandName}}',
  },
  {
    key: 'payment.received',
    description: 'Sent when a payment is recorded',
    variables: ['name', 'reference', 'amount', 'simulatedNote', 'brandName'],
    subject: 'Payment recorded for {{reference}}',
    body: 'Hello {{name}},\n\nA payment of {{amount}} has been recorded for booking {{reference}}.{{simulatedNote}}\n\n{{brandName}}',
  },
  {
    key: 'payment.failed',
    description: 'Sent when a payment attempt fails',
    variables: ['name', 'reference', 'brandName'],
    subject: 'Payment not completed for {{reference}}',
    body: 'Hello {{name}},\n\nThe payment for booking {{reference}} did not complete. You can try again from your booking page.\n\n{{brandName}}',
  },
  {
    key: 'enquiry.received',
    description: 'Sent when a project or event enquiry is submitted',
    variables: ['name', 'reference', 'eventType', 'date', 'link', 'brandName'],
    subject: 'Enquiry {{reference}} received',
    body: 'Hello {{name}},\n\nThank you for your enquiry {{reference}} ({{eventType}}, preferred date {{date}}).\nThis is not a booking yet. Our team will review it and prepare a proposal.\n\nFollow your enquiry: {{link}}\n\n{{brandName}}',
  },
  {
    key: 'quotation.sent',
    description: 'Sent when a quotation is sent to the customer',
    variables: ['name', 'reference', 'total', 'validUntil', 'link', 'brandName'],
    subject: 'Your proposal {{reference}}',
    body: 'Hello {{name}},\n\nYour proposal {{reference}} totals {{total}} and is valid until {{validUntil}}.\nReview it here: {{link}}\n\n{{brandName}}',
  },
  {
    key: 'contact.received',
    description: 'Acknowledgement of a contact-form message',
    variables: ['name', 'brandName'],
    subject: 'We received your message',
    body: 'Hello {{name}},\n\nThank you for contacting {{brandName}}. The team will reply as soon as possible.',
  },
  {
    key: 'staff.new_booking',
    description: 'Sent to the business email for every new booking or booking request',
    variables: ['reference', 'service', 'when', 'customer', 'status', 'adminLink'],
    subject: 'New booking {{reference}}: {{service}}',
    body: 'New booking {{reference}} ({{status}})\nService: {{service}}\nWhen: {{when}}\nCustomer: {{customer}}\n\nOpen in admin: {{adminLink}}',
  },
  {
    key: 'staff.new_enquiry',
    description: 'Sent to the business email for every new enquiry',
    variables: ['reference', 'eventType', 'date', 'customer', 'adminLink'],
    subject: 'New enquiry {{reference}}: {{eventType}}',
    body: 'New enquiry {{reference}}\nProject: {{eventType}}\nPreferred date: {{date}}\nCustomer: {{customer}}\n\nOpen in admin: {{adminLink}}',
  },
  {
    key: 'auth.password_reset',
    description: 'Password reset link',
    variables: ['name', 'link'],
    subject: 'Reset your password',
    body: 'Hello {{name}},\n\nUse this link to reset your password: {{link}}\nIf you did not request this, you can ignore this message.',
  },
  {
    key: 'auth.verify_email',
    description: 'Email verification link',
    variables: ['name', 'link'],
    subject: 'Verify your email address',
    body: 'Hello {{name}},\n\nConfirm your email address: {{link}}',
  },
];

export interface RenderedMessage {
  subject: string;
  text: string;
}

type Data = Record<string, string | number | undefined | null>;

export function interpolate(template: string, data: Data): string {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, k: string) => {
    const v = data[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function renderTemplate(key: TemplateKey, d: Data, override?: { subject: string; body: string } | null): RenderedMessage {
  const def = TEMPLATE_DEFINITIONS.find((t) => t.key === key)!;
  const subject = override?.subject ?? def.subject;
  const body = override?.body ?? def.body;
  return { subject: interpolate(subject, d), text: interpolate(body, d).replace(/\n{3,}/g, '\n\n') };
}
