import { TZDate } from '@date-fns/tz';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export function parseLocalDate(value: string): LocalDate | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // Reject impossible dates such as 2026-02-30.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function formatLocalDate(d: LocalDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** UTC instant for a wall-clock time (minutes after midnight) on a local date in `tz`. */
export function zonedToUtc(date: LocalDate, minuteOfDay: number, tz: string): Date {
  const h = Math.floor(minuteOfDay / 60);
  const min = minuteOfDay % 60;
  const zoned = new TZDate(date.year, date.month - 1, date.day, h, min, tz);
  return new Date(zoned.getTime());
}

/** Weekday (0 = Sunday) of a local date in `tz`. */
export function localDayOfWeek(date: LocalDate, tz: string): number {
  return new TZDate(date.year, date.month - 1, date.day, 12, 0, tz).getDay();
}

/** Local calendar date and minute-of-day for an instant in `tz`. */
export function utcToZoned(instant: Date, tz: string): { date: LocalDate; minuteOfDay: number } {
  const z = new TZDate(instant.getTime(), tz);
  return {
    date: { year: z.getFullYear(), month: z.getMonth() + 1, day: z.getDate() },
    minuteOfDay: z.getHours() * 60 + z.getMinutes(),
  };
}

export function todayIn(tz: string, now = new Date()): LocalDate {
  return utcToZoned(now, tz).date;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return formatLocalDate(a).localeCompare(formatLocalDate(b));
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

export function minutesToHHMM(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function hhmmToMinutes(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return value === '24:00' ? 1440 : null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
