import { addDays, compareLocalDates, formatLocalDate, localDayOfWeek, minutesToHHMM, overlaps, type LocalDate, zonedToUtc } from '../time';

export interface Interval {
  from: Date;
  to: Date;
}

export interface WeeklyHours {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
}

export interface ResourceSchedule {
  id: string;
  name: string;
  /** Resource-specific weekly hours. When empty the location hours apply. */
  hours: WeeklyHours[];
  /** Existing reservations (already including their buffers) and resource blocks. */
  busy: Interval[];
}

export interface AvailabilityRules {
  timezone: string;
  durationMin: number;
  bufferMin: number;
  slotIntervalMin: number;
  /** Earliest permissible start instant (now + lead time). */
  earliestStart: Date;
  /** Last local date that can be booked (today + max advance days). */
  lastBookableDate: LocalDate;
  /** True when the service needs an exclusive resource. */
  requiresResource: boolean;
}

export interface Slot {
  start: Date;
  end: Date;
  /** Local start time, HH:MM, in the location's timezone. */
  startTime: string;
  endTime: string;
  availableResourceIds: string[];
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  isOpen: boolean;
  slots: Slot[];
}

function hoursForDay(hours: WeeklyHours[], dayOfWeek: number) {
  return hours.filter((h) => h.dayOfWeek === dayOfWeek);
}

/**
 * Whether `[start, start + duration + buffer)` fits for a resource on a given local
 * date. Pure: all data must be supplied by the caller.
 */
export function windowFitsResource(
  date: LocalDate,
  startMinute: number,
  rules: Pick<AvailabilityRules, 'timezone' | 'durationMin' | 'bufferMin'>,
  locationHours: WeeklyHours[],
  locationBlocks: Interval[],
  resource: ResourceSchedule | null,
): boolean {
  const dow = localDayOfWeek(date, rules.timezone);
  const effectiveHours = resource && resource.hours.length ? resource.hours : locationHours;
  const endMinute = startMinute + rules.durationMin;
  const fitsHours = hoursForDay(effectiveHours, dow).some((h) => startMinute >= h.openMinute && endMinute <= h.closeMinute);
  if (!fitsHours) return false;

  const start = zonedToUtc(date, startMinute, rules.timezone);
  const end = new Date(start.getTime() + rules.durationMin * 60_000);
  const blockedUntil = new Date(end.getTime() + rules.bufferMin * 60_000);

  // Location-wide closures affect the booked session itself (not the turnaround buffer).
  if (locationBlocks.some((b) => overlaps(start, end, b.from, b.to))) return false;
  if (resource && resource.busy.some((b) => overlaps(start, blockedUntil, b.from, b.to))) return false;
  return true;
}

/** Compute bookable slots for each date in a range. */
export function computeAvailability(
  fromDate: LocalDate,
  days: number,
  rules: AvailabilityRules,
  locationHours: WeeklyHours[],
  locationBlocks: Interval[],
  resources: ResourceSchedule[],
): DayAvailability[] {
  const result: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const dow = localDayOfWeek(date, rules.timezone);
    const day: DayAvailability = { date: formatLocalDate(date), dayOfWeek: dow, isOpen: false, slots: [] };
    result.push(day);
    if (compareLocalDates(date, rules.lastBookableDate) > 0) continue;

    // Candidate start minutes come from the union of the location's and resources' opening hours.
    const windows = [
      ...hoursForDay(locationHours, dow),
      ...resources.flatMap((r) => hoursForDay(r.hours, dow)),
    ];
    if (!windows.length) continue;
    day.isOpen = true;

    const candidates = new Set<number>();
    for (const w of windows) {
      for (let m = w.openMinute; m + rules.durationMin <= w.closeMinute; m += rules.slotIntervalMin) candidates.add(m);
    }

    for (const minute of [...candidates].sort((a, b) => a - b)) {
      const start = zonedToUtc(date, minute, rules.timezone);
      if (start < rules.earliestStart) continue;
      const end = new Date(start.getTime() + rules.durationMin * 60_000);

      let availableResourceIds: string[];
      if (rules.requiresResource) {
        availableResourceIds = resources
          .filter((r) => windowFitsResource(date, minute, rules, locationHours, locationBlocks, r))
          .map((r) => r.id);
        if (!availableResourceIds.length) continue;
      } else {
        if (!windowFitsResource(date, minute, rules, locationHours, locationBlocks, null)) continue;
        availableResourceIds = [];
      }
      day.slots.push({
        start,
        end,
        startTime: minutesToHHMM(minute),
        endTime: minutesToHHMM(minute + rules.durationMin),
        availableResourceIds,
      });
    }
  }
  return result;
}
