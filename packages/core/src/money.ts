/** Money helpers. All amounts are integer minor units (e.g. paise). */

/** Round half away from zero to an integer number of minor units. */
export function roundMinor(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Apply a rate expressed in basis points (1 bp = 0.01%). */
export function applyBps(amountMinor: number, bps: number): number {
  return roundMinor((amountMinor * bps) / 10_000);
}

export function formatMoney(amountMinor: number, currency = 'INR', locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function toMinor(major: number): number {
  return roundMinor(major * 100);
}
