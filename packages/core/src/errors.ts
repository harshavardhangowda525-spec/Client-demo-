export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'UNAVAILABLE'
  | 'INVALID_TRANSITION'
  | 'PAYMENT_ERROR'
  | 'INTEGRATION_NOT_CONFIGURED'
  | 'RATE_LIMITED';

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  UNAVAILABLE: 409,
  INVALID_TRANSITION: 409,
  PAYMENT_ERROR: 402,
  INTEGRATION_NOT_CONFIGURED: 503,
  RATE_LIMITED: 429,
};

/**
 * An expected, user-presentable failure. Messages must never contain secrets or
 * another customer's data; they are returned to API clients verbatim.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

export const notFound = (what: string) => new DomainError('NOT_FOUND', `${what} not found.`);
export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new DomainError('FORBIDDEN', message);
export const invalid = (message: string, details?: unknown) =>
  new DomainError('VALIDATION', message, details);
