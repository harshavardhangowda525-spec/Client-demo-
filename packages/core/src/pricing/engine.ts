import { applyBps, roundMinor } from '../money';
import type { FeeRule } from '../settings';

export const PRICING_VERSION = 'pricing-v1';

export type BaseCharge =
  | { kind: 'FIXED'; refId: string; label: string; amountMinor: number }
  | { kind: 'HOURLY'; refId: string; label: string; rateMinor: number }
  | { kind: 'PACKAGE'; refId: string; label: string; amountMinor: number }
  | {
      kind: 'QUOTE';
      lines: { description: string; quantity: number; unitPriceMinor: number }[];
    };

export interface AddOnCharge {
  refId: string;
  label: string;
  pricing: 'FIXED' | 'PER_HOUR';
  priceMinor: number;
  quantity?: number;
}

export interface PricingInput {
  currency: string;
  durationMin: number;
  base: BaseCharge;
  addOns?: AddOnCharge[];
  discountMinor?: number;
  taxRateBps: number;
  taxLabel: string;
  fees?: FeeRule[];
  depositBps: number;
  minimumDepositMinor?: number;
}

export interface PriceLine {
  kind: 'SERVICE' | 'PACKAGE' | 'ADDON' | 'QUOTE_LINE' | 'FEE' | 'TAX' | 'DISCOUNT';
  refId: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}

export interface PriceBreakdown {
  pricingVersion: string;
  currency: string;
  durationMin: number;
  lines: PriceLine[];
  subtotalMinor: number;
  discountMinor: number;
  feesMinor: number;
  taxableMinor: number;
  taxRateBps: number;
  taxLabel: string;
  taxMinor: number;
  totalMinor: number;
  depositBps: number;
  depositMinor: number;
  balanceMinor: number;
}

function assertNonNegativeInt(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer (minor units), received ${value}`);
  }
}

/**
 * Authoritative price calculation. Pure and deterministic: the same input always
 * produces the same breakdown. Callers must build the input from database
 * records, never from browser-submitted prices.
 */
export function calculatePrice(input: PricingInput): PriceBreakdown {
  const { durationMin } = input;
  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    throw new RangeError('durationMin must be a positive integer');
  }
  assertNonNegativeInt(input.taxRateBps, 'taxRateBps');
  assertNonNegativeInt(input.depositBps, 'depositBps');
  if (input.depositBps > 10_000) throw new RangeError('depositBps cannot exceed 10000');

  const hours = durationMin / 60;
  const lines: PriceLine[] = [];
  const base = input.base;

  switch (base.kind) {
    case 'FIXED':
      assertNonNegativeInt(base.amountMinor, 'amountMinor');
      lines.push({ kind: 'SERVICE', refId: base.refId, description: base.label, quantity: 1, unitPriceMinor: base.amountMinor, totalMinor: base.amountMinor });
      break;
    case 'PACKAGE':
      assertNonNegativeInt(base.amountMinor, 'amountMinor');
      lines.push({ kind: 'PACKAGE', refId: base.refId, description: base.label, quantity: 1, unitPriceMinor: base.amountMinor, totalMinor: base.amountMinor });
      break;
    case 'HOURLY':
      assertNonNegativeInt(base.rateMinor, 'rateMinor');
      lines.push({
        kind: 'SERVICE',
        refId: base.refId,
        description: `${base.label} (${formatHours(hours)} × hourly rate)`,
        quantity: hours,
        unitPriceMinor: base.rateMinor,
        totalMinor: roundMinor(base.rateMinor * hours),
      });
      break;
    case 'QUOTE':
      if (base.lines.length === 0) throw new RangeError('A quotation needs at least one line');
      for (const l of base.lines) {
        assertNonNegativeInt(l.unitPriceMinor, 'unitPriceMinor');
        if (!(l.quantity > 0)) throw new RangeError('Quotation line quantity must be positive');
        lines.push({ kind: 'QUOTE_LINE', refId: null, description: l.description, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, totalMinor: roundMinor(l.unitPriceMinor * l.quantity) });
      }
      break;
  }

  for (const addOn of input.addOns ?? []) {
    assertNonNegativeInt(addOn.priceMinor, 'addOn.priceMinor');
    const qty = addOn.pricing === 'PER_HOUR' ? hours : (addOn.quantity ?? 1);
    lines.push({
      kind: 'ADDON',
      refId: addOn.refId,
      description: addOn.pricing === 'PER_HOUR' ? `${addOn.label} (${formatHours(hours)})` : addOn.label,
      quantity: qty,
      unitPriceMinor: addOn.priceMinor,
      totalMinor: roundMinor(addOn.priceMinor * qty),
    });
  }

  const subtotalMinor = lines.reduce((sum, l) => sum + l.totalMinor, 0);
  const discountMinor = Math.min(input.discountMinor ?? 0, subtotalMinor);
  assertNonNegativeInt(discountMinor, 'discountMinor');
  if (discountMinor > 0) {
    lines.push({ kind: 'DISCOUNT', refId: null, description: 'Discount', quantity: 1, unitPriceMinor: -discountMinor, totalMinor: -discountMinor });
  }
  const afterDiscount = subtotalMinor - discountMinor;

  let feesMinor = 0;
  for (const fee of input.fees ?? []) {
    const amount = fee.type === 'PERCENT' ? applyBps(afterDiscount, fee.value) : fee.value;
    if (amount === 0) continue;
    feesMinor += amount;
    lines.push({ kind: 'FEE', refId: fee.code, description: fee.label, quantity: 1, unitPriceMinor: amount, totalMinor: amount });
  }

  const taxableMinor = afterDiscount + feesMinor;
  const taxMinor = applyBps(taxableMinor, input.taxRateBps);
  if (taxMinor > 0) {
    lines.push({ kind: 'TAX', refId: null, description: input.taxLabel, quantity: 1, unitPriceMinor: taxMinor, totalMinor: taxMinor });
  }
  const totalMinor = taxableMinor + taxMinor;

  let depositMinor = applyBps(totalMinor, input.depositBps);
  depositMinor = Math.max(depositMinor, input.minimumDepositMinor ?? 0);
  depositMinor = Math.min(depositMinor, totalMinor);

  return {
    pricingVersion: PRICING_VERSION,
    currency: input.currency,
    durationMin,
    lines,
    subtotalMinor,
    discountMinor,
    feesMinor,
    taxableMinor,
    taxRateBps: input.taxRateBps,
    taxLabel: input.taxLabel,
    taxMinor,
    totalMinor,
    depositBps: input.depositBps,
    depositMinor,
    balanceMinor: totalMinor - depositMinor,
  };
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}
