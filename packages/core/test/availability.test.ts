import { describe, expect, it } from 'vitest';
import { computeAvailability, windowFitsResource, type AvailabilityRules, type ResourceSchedule, type WeeklyHours } from '../src/availability/engine';
import { zonedToUtc } from '../src/time';

const TZ = 'Asia/Kolkata';
const day = { year: 2026, month: 11, day: 2 }; // Monday
const hours: WeeklyHours[] = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, openMinute: 9 * 60, closeMinute: 18 * 60 }));
const at = (h: number, m = 0) => zonedToUtc(day, h * 60 + m, TZ);

const rules = (over: Partial<AvailabilityRules> = {}): AvailabilityRules => ({
  timezone: TZ,
  durationMin: 120,
  bufferMin: 0,
  slotIntervalMin: 60,
  earliestStart: new Date('2026-01-01T00:00:00Z'),
  lastBookableDate: { year: 2027, month: 1, day: 1 },
  requiresResource: true,
  ...over,
});
const room = (busy: { from: Date; to: Date }[] = [], h: WeeklyHours[] = []): ResourceSchedule => ({ id: 'r1', name: 'Room', hours: h, busy });

describe('availability engine', () => {
  it('produces slots that fit inside opening hours', () => {
    const [d] = computeAvailability(day, 1, rules(), hours, [], [room()]);
    expect(d!.isOpen).toBe(true);
    expect(d!.slots.map((s) => s.startTime)).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
    expect(d!.slots[0]!.start.toISOString()).toBe('2026-11-02T03:30:00.000Z');
  });

  it('marks closed days', () => {
    const [sun] = computeAvailability({ year: 2026, month: 11, day: 1 }, 1, rules(), hours, [], [room()]);
    expect(sun!.isOpen).toBe(false);
    expect(sun!.slots).toEqual([]);
  });

  it('excludes slots that overlap existing reservations, including the new booking buffer', () => {
    const busy = [{ from: at(12), to: at(13) }];
    const [d] = computeAvailability(day, 1, rules({ bufferMin: 30 }), hours, [], [room(busy)]);
    const starts = d!.slots.map((s) => s.startTime);
    // 10:00-12:00 + 30 min buffer would run into 12:00 -> excluded; 11:00 and 12:00 overlap directly.
    expect(starts).not.toContain('10:00');
    expect(starts).not.toContain('11:00');
    expect(starts).not.toContain('12:00');
    expect(starts).toContain('09:00'); // 09:00-11:00 +30 = 11:30 < 12:00
    expect(starts).toContain('13:00');
  });

  it('respects lead time', () => {
    const [d] = computeAvailability(day, 1, rules({ earliestStart: at(14, 30) }), hours, [], [room()]);
    expect(d!.slots.map((s) => s.startTime)).toEqual(['15:00', '16:00']);
  });

  it('respects the maximum advance window', () => {
    const [d] = computeAvailability(day, 1, rules({ lastBookableDate: { year: 2026, month: 11, day: 1 } }), hours, [], [room()]);
    expect(d!.slots).toEqual([]);
  });

  it('applies location-wide closures', () => {
    const [d] = computeAvailability(day, 1, rules(), hours, [{ from: at(0), to: at(23, 59) }], [room()]);
    expect(d!.slots).toEqual([]);
  });

  it('uses resource-specific hours when present', () => {
    const r = room([], [{ dayOfWeek: 1, openMinute: 14 * 60, closeMinute: 18 * 60 }]);
    const [d] = computeAvailability(day, 1, rules(), hours, [], [r]);
    expect(d!.slots.map((s) => s.startTime)).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].filter((t) => t >= '14:00'));
  });

  it('reports which resources are free for each slot', () => {
    const busyRoom = { ...room([{ from: at(9), to: at(18) }]), id: 'busy' };
    const freeRoom = { ...room(), id: 'free' };
    const [d] = computeAvailability(day, 1, rules(), hours, [], [busyRoom, freeRoom]);
    expect(d!.slots.every((s) => s.availableResourceIds.length === 1 && s.availableResourceIds[0] === 'free')).toBe(true);
  });

  it('windowFitsResource rejects a session running past closing time', () => {
    expect(windowFitsResource(day, 17 * 60, rules(), hours, [], room())).toBe(false);
    expect(windowFitsResource(day, 16 * 60, rules(), hours, [], room())).toBe(true);
  });
});
