import { describe, expect, it } from 'vitest';
import { hhmmToMinutes, localDayOfWeek, parseLocalDate, utcToZoned, zonedToUtc } from '../src/time';
import { allowedTransitions, canTransition, BOOKING_STATUSES, TERMINAL_STATUSES } from '../src/booking/status';
import { ROLE_DEFINITIONS } from '../src/permissions';
import { can, requirePermission, type Actor } from '../src/actor';
import { generateReference, generateAccessToken, verifyToken } from '../src/ids';

describe('date validation and timezones', () => {
  it('rejects impossible and malformed dates', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('2026-13-01')).toBeNull();
    expect(parseLocalDate('26-1-1')).toBeNull();
    expect(parseLocalDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('converts IST wall-clock to UTC', () => {
    expect(zonedToUtc({ year: 2026, month: 11, day: 2 }, 10 * 60, 'Asia/Kolkata').toISOString()).toBe('2026-11-02T04:30:00.000Z');
    expect(utcToZoned(new Date('2026-11-02T04:30:00Z'), 'Asia/Kolkata')).toEqual({ date: { year: 2026, month: 11, day: 2 }, minuteOfDay: 600 });
  });

  it('handles daylight-saving zones correctly', () => {
    // 2026-03-08 is the US spring-forward date; 10:00 local is EDT (UTC-4).
    expect(zonedToUtc({ year: 2026, month: 3, day: 8 }, 600, 'America/New_York').toISOString()).toBe('2026-03-08T14:00:00.000Z');
    expect(zonedToUtc({ year: 2026, month: 3, day: 7 }, 600, 'America/New_York').toISOString()).toBe('2026-03-07T15:00:00.000Z');
  });

  it('computes local weekday', () => {
    expect(localDayOfWeek({ year: 2026, month: 10, day: 24 }, 'Asia/Kolkata')).toBe(6);
  });

  it('parses HH:MM', () => {
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(hhmmToMinutes('24:00')).toBe(1440);
    expect(hhmmToMinutes('25:00')).toBeNull();
    expect(hhmmToMinutes('9:30')).toBeNull();
  });
});

describe('booking status transitions', () => {
  it('allows the payment path only for the system or staff', () => {
    expect(canTransition('AWAITING_PAYMENT', 'CONFIRMED', 'SYSTEM')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'CONFIRMED', 'CUSTOMER')).toBe(false);
    expect(canTransition('ENQUIRY_SUBMITTED', 'CONFIRMED', 'STAFF')).toBe(false);
  });

  it('customers can only cancel or request cancellation', () => {
    for (const s of BOOKING_STATUSES) {
      for (const to of allowedTransitions(s, 'CUSTOMER')) expect(['CANCELLED', 'CANCELLATION_REQUESTED']).toContain(to);
    }
  });

  it('terminal statuses have no exits', () => {
    for (const s of TERMINAL_STATUSES) {
      expect(allowedTransitions(s, 'STAFF')).toEqual([]);
      expect(allowedTransitions(s, 'SYSTEM')).toEqual([]);
    }
  });

  it('cannot skip from completed back to confirmed', () => {
    expect(canTransition('COMPLETED', 'CONFIRMED', 'STAFF')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED', 'STAFF')).toBe(false);
  });
});

describe('permissions', () => {
  const mk = (role: string): Actor => ({ userId: role, email: `${role}@x`, name: role, role, isStaff: ROLE_DEFINITIONS[role]!.isStaff, permissions: new Set(ROLE_DEFINITIONS[role]!.permissions) });

  it('customers have no administrative permissions', () => {
    expect(can(mk('customer'), 'bookings.read')).toBe(false);
    expect(() => requirePermission(mk('customer'), 'bookings.read')).toThrow(/permission/);
    expect(() => requirePermission(null, 'bookings.read')).toThrow(/Sign in/);
  });

  it('staff cannot manage settings, refunds, audit or users', () => {
    const staff = mk('staff');
    expect(can(staff, 'bookings.manage')).toBe(true);
    for (const p of ['settings.manage', 'payments.refund', 'audit.read', 'users.manage'] as const) expect(can(staff, p)).toBe(false);
  });

  it('managers cannot manage users or settings; admins can do everything', () => {
    expect(can(mk('manager'), 'users.manage')).toBe(false);
    expect(can(mk('manager'), 'settings.manage')).toBe(false);
    expect(can(mk('manager'), 'audit.read')).toBe(true);
    expect(can(mk('admin'), 'users.manage')).toBe(true);
  });
});

describe('references and tokens', () => {
  it('generates non-sequential references in the expected format', () => {
    const refs = new Set(Array.from({ length: 500 }, () => generateReference('PH')));
    expect(refs.size).toBe(500);
    for (const r of refs) expect(r).toMatch(/^PH-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('verifies access tokens against their hash only', () => {
    const { token, hash } = generateAccessToken();
    expect(verifyToken(token, hash)).toBe(true);
    expect(verifyToken(token + 'x', hash)).toBe(false);
    expect(verifyToken(undefined, hash)).toBe(false);
    expect(hash).not.toContain(token);
  });
});
