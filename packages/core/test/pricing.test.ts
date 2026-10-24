import { describe, expect, it } from 'vitest';
import { calculatePrice, type PricingInput } from '../src/pricing/engine';

const base: Omit<PricingInput, 'base' | 'durationMin'> = {
  currency: 'INR',
  taxRateBps: 1800,
  taxLabel: 'GST',
  depositBps: 3000,
};

describe('pricing engine', () => {
  it('prices a fixed service with tax and deposit', () => {
    const r = calculatePrice({ ...base, durationMin: 90, base: { kind: 'FIXED', refId: 's', label: 'Portrait', amountMinor: 600_000 } });
    expect(r.subtotalMinor).toBe(600_000);
    expect(r.taxMinor).toBe(108_000);
    expect(r.totalMinor).toBe(708_000);
    expect(r.depositMinor).toBe(212_400);
    expect(r.balanceMinor).toBe(708_000 - 212_400);
    expect(r.lines.map((l) => l.kind)).toEqual(['SERVICE', 'TAX']);
  });

  it('prices hourly services by exact duration (90 minutes = 1.5 hours)', () => {
    const r = calculatePrice({ ...base, durationMin: 90, base: { kind: 'HOURLY', refId: 's', label: 'Studio', rateMinor: 250_000 } });
    expect(r.lines[0]!.quantity).toBe(1.5);
    expect(r.subtotalMinor).toBe(375_000);
  });

  it('adds fixed and per-hour add-ons', () => {
    const r = calculatePrice({
      ...base,
      durationMin: 120,
      base: { kind: 'PACKAGE', refId: 'p', label: 'Package', amountMinor: 1_000_000 },
      addOns: [
        { refId: 'a', label: 'Retouching', pricing: 'FIXED', priceMinor: 350_000 },
        { refId: 'b', label: 'Engineer', pricing: 'PER_HOUR', priceMinor: 90_000 },
      ],
    });
    expect(r.subtotalMinor).toBe(1_000_000 + 350_000 + 180_000);
    expect(r.lines.filter((l) => l.kind === 'ADDON')).toHaveLength(2);
  });

  it('applies discount (capped at subtotal), percentage and fixed fees, then tax', () => {
    const r = calculatePrice({
      ...base,
      durationMin: 60,
      base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 100_000 },
      discountMinor: 10_000,
      fees: [
        { code: 'svc', label: 'Service fee', type: 'PERCENT', value: 500 },
        { code: 'clean', label: 'Cleaning', type: 'FIXED', value: 2_000 },
      ],
    });
    // 100000 - 10000 = 90000; fees 4500 + 2000; taxable 96500; tax 17370
    expect(r.discountMinor).toBe(10_000);
    expect(r.feesMinor).toBe(6_500);
    expect(r.taxableMinor).toBe(96_500);
    expect(r.taxMinor).toBe(17_370);
    expect(r.totalMinor).toBe(113_870);
    const huge = calculatePrice({ ...base, durationMin: 60, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 5_000 }, discountMinor: 999_999 });
    expect(huge.discountMinor).toBe(5_000);
    expect(huge.totalMinor).toBe(0);
  });

  it('rounds half away from zero on paise', () => {
    // 18% of 1 paisa = 0.18 -> 0; 18% of 3 paise = 0.54 -> 1
    expect(calculatePrice({ ...base, durationMin: 60, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 3 } }).taxMinor).toBe(1);
  });

  it('enforces minimum deposit but never exceeds the total', () => {
    const r = calculatePrice({ ...base, durationMin: 60, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 1_000 }, minimumDepositMinor: 50_000 });
    expect(r.depositMinor).toBe(r.totalMinor);
    const full = calculatePrice({ ...base, depositBps: 10_000, durationMin: 60, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 1_000 } });
    expect(full.depositMinor).toBe(full.totalMinor);
    expect(full.balanceMinor).toBe(0);
  });

  it('prices custom quotations line by line', () => {
    const r = calculatePrice({
      ...base,
      durationMin: 60,
      base: { kind: 'QUOTE', lines: [{ description: 'Planning', quantity: 1, unitPriceMinor: 1_500_000 }, { description: 'Catering', quantity: 120, unitPriceMinor: 180_000 }] },
    });
    expect(r.subtotalMinor).toBe(1_500_000 + 21_600_000);
  });

  it('is deterministic', () => {
    const input: PricingInput = { ...base, durationMin: 150, base: { kind: 'HOURLY', refId: 's', label: 'S', rateMinor: 333_333 } };
    expect(calculatePrice(input)).toEqual(calculatePrice(input));
  });

  it('rejects invalid inputs', () => {
    expect(() => calculatePrice({ ...base, durationMin: 0, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 1 } })).toThrow();
    expect(() => calculatePrice({ ...base, durationMin: 60, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: -1 } })).toThrow();
    expect(() => calculatePrice({ ...base, durationMin: 60, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 1.5 } })).toThrow();
    expect(() => calculatePrice({ ...base, depositBps: 12_000, durationMin: 60, base: { kind: 'FIXED', refId: 's', label: 'S', amountMinor: 1 } })).toThrow();
    expect(() => calculatePrice({ ...base, durationMin: 60, base: { kind: 'QUOTE', lines: [] } })).toThrow();
  });
});
