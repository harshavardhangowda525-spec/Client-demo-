// Booking lifecycle. Kept free of database imports so websites can import the
// labels without pulling server code into browser bundles.

export const BOOKING_STATUSES = [
  'DRAFT',
  'ENQUIRY_SUBMITTED',
  'AWAITING_REVIEW',
  'AWAITING_PAYMENT',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLATION_REQUESTED',
  'CANCELLED',
  'REJECTED',
] as const;

export type BookingStatusValue = (typeof BOOKING_STATUSES)[number];

/** Statuses that hold an exclusive resource. Mirrors the database exclusion constraint. */
export const ACTIVE_BOOKING_STATUSES = [
  'ENQUIRY_SUBMITTED',
  'AWAITING_REVIEW',
  'AWAITING_PAYMENT',
  'PAYMENT_PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'CANCELLATION_REQUESTED',
] as const satisfies readonly BookingStatusValue[];

export const TERMINAL_STATUSES: readonly BookingStatusValue[] = ['COMPLETED', 'CANCELLED', 'REJECTED'];

export const STATUS_LABELS: Record<BookingStatusValue, string> = {
  DRAFT: 'Draft',
  ENQUIRY_SUBMITTED: 'Request submitted',
  AWAITING_REVIEW: 'Awaiting review',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAYMENT_PENDING: 'Payment pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLATION_REQUESTED: 'Cancellation requested',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

export const STATUS_DESCRIPTIONS: Record<BookingStatusValue, string> = {
  DRAFT: 'Being prepared by the team.',
  ENQUIRY_SUBMITTED: 'Your request has been received. The slot is held while the team reviews it.',
  AWAITING_REVIEW: 'The team is reviewing your request.',
  AWAITING_PAYMENT: 'The slot is held for you. Pay the deposit to confirm.',
  PAYMENT_PENDING: 'We are waiting for the payment provider to verify your payment.',
  CONFIRMED: 'Your booking is confirmed.',
  IN_PROGRESS: 'Your session is under way.',
  COMPLETED: 'This booking is complete.',
  CANCELLATION_REQUESTED: 'Your cancellation request is with the team.',
  CANCELLED: 'This booking was cancelled.',
  REJECTED: 'The team was unable to accept this request.',
};

export type TransitionActor = 'CUSTOMER' | 'STAFF' | 'SYSTEM';

interface TransitionRule {
  to: BookingStatusValue;
  actors: TransitionActor[];
}

const RULES: Record<BookingStatusValue, TransitionRule[]> = {
  DRAFT: [
    { to: 'AWAITING_REVIEW', actors: ['STAFF'] },
    { to: 'AWAITING_PAYMENT', actors: ['STAFF'] },
    { to: 'CANCELLED', actors: ['STAFF'] },
  ],
  ENQUIRY_SUBMITTED: [
    { to: 'AWAITING_REVIEW', actors: ['STAFF'] },
    { to: 'AWAITING_PAYMENT', actors: ['STAFF'] },
    { to: 'REJECTED', actors: ['STAFF'] },
    { to: 'CANCELLED', actors: ['STAFF', 'CUSTOMER'] },
  ],
  AWAITING_REVIEW: [
    { to: 'AWAITING_PAYMENT', actors: ['STAFF'] },
    { to: 'CONFIRMED', actors: ['STAFF'] },
    { to: 'REJECTED', actors: ['STAFF'] },
    { to: 'CANCELLED', actors: ['STAFF', 'CUSTOMER'] },
  ],
  AWAITING_PAYMENT: [
    { to: 'PAYMENT_PENDING', actors: ['SYSTEM'] },
    { to: 'CONFIRMED', actors: ['SYSTEM', 'STAFF'] },
    { to: 'CANCELLED', actors: ['STAFF', 'CUSTOMER', 'SYSTEM'] },
  ],
  PAYMENT_PENDING: [
    { to: 'CONFIRMED', actors: ['SYSTEM', 'STAFF'] },
    { to: 'AWAITING_PAYMENT', actors: ['SYSTEM', 'STAFF'] },
    { to: 'CANCELLED', actors: ['STAFF', 'SYSTEM'] },
  ],
  CONFIRMED: [
    { to: 'IN_PROGRESS', actors: ['STAFF'] },
    { to: 'COMPLETED', actors: ['STAFF'] },
    { to: 'CANCELLATION_REQUESTED', actors: ['CUSTOMER', 'STAFF'] },
    { to: 'CANCELLED', actors: ['STAFF'] },
  ],
  IN_PROGRESS: [{ to: 'COMPLETED', actors: ['STAFF'] }],
  CANCELLATION_REQUESTED: [
    { to: 'CANCELLED', actors: ['STAFF'] },
    { to: 'CONFIRMED', actors: ['STAFF'] },
  ],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function allowedTransitions(from: BookingStatusValue, actor: TransitionActor): BookingStatusValue[] {
  return RULES[from].filter((r) => r.actors.includes(actor)).map((r) => r.to);
}

export function canTransition(from: BookingStatusValue, to: BookingStatusValue, actor: TransitionActor): boolean {
  return RULES[from].some((r) => r.to === to && r.actors.includes(actor));
}

export function isActiveStatus(status: BookingStatusValue): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'No payment required',
  UNPAID: 'Unpaid',
  PENDING: 'Verification pending',
  PARTIALLY_PAID: 'Deposit paid',
  PAID: 'Paid in full',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
  FAILED: 'Payment failed',
};
