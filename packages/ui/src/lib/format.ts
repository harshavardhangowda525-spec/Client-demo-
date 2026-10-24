import { formatMoney as coreFormatMoney } from '@studio/core/money';

export const formatMoney = (minor: number, currency = 'INR') => coreFormatMoney(minor, currency);

export function formatDateTime(iso: string | Date, tz: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...opts }).format(new Date(iso));
}

export function formatTime(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Format a YYYY-MM-DD calendar date without timezone drift. */
export function formatCalendarDate(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} ${h === 1 ? 'hour' : 'hours'}`;
}

export function priceFrom(s: { pricingModel: string; basePriceMinor: number; hourlyRateMinor: number; packages: { priceMinor: number }[] }) {
  if (s.pricingModel === 'QUOTE') return 'Priced by quotation';
  if (s.pricingModel === 'HOURLY') return `${formatMoney(s.hourlyRateMinor)} / hour`;
  const prices = [s.basePriceMinor, ...s.packages.map((p) => p.priceMinor)].filter((p) => p > 0);
  return prices.length ? `From ${formatMoney(Math.min(...prices))}` : 'Price on request';
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
