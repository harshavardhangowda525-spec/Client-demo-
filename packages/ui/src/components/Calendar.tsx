'use client';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface CalendarDay {
  date: string;
  isOpen: boolean;
  slotCount: number;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y!, m! - 1, 1)));
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Month grid. Only days with at least one verified slot are selectable. */
export function Calendar({
  month,
  days,
  selected,
  onSelect,
  onMonthChange,
  minMonth,
  maxMonth,
  loading,
}: {
  month: string;
  days: Record<string, CalendarDay>;
  selected: string | null;
  onSelect: (date: string) => void;
  onMonthChange: (month: string) => void;
  minMonth: string;
  maxMonth: string;
  loading?: boolean;
}) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const cells: (string | null)[] = [...Array(leading).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);

  return (
    <div className="calendar" aria-busy={loading || undefined}>
      <div className="calendar__head">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onMonthChange(shiftMonth(month, -1))} disabled={month <= minMonth} aria-label="Previous month">
          ←
        </button>
        <p style={{ margin: 0, fontWeight: 600 }} aria-live="polite">
          {monthLabel(month)} {loading && <span className="spinner" aria-label="Loading availability" style={{ verticalAlign: 'middle', marginLeft: 8 }} />}
        </p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onMonthChange(shiftMonth(month, 1))} disabled={month >= maxMonth} aria-label="Next month">
          →
        </button>
      </div>
      <div className="calendar__grid" role="group" aria-label={`Available dates in ${monthLabel(month)}`}>
        {DOW.map((d) => (
          <div key={d} className="calendar__dow" aria-hidden="true">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`b${i}`} />;
          const info = days[date];
          const available = !!info && info.slotCount > 0;
          const label = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
          return (
            <button
              key={date}
              type="button"
              className="calendar__day"
              data-available={available}
              aria-pressed={selected === date}
              disabled={!available}
              onClick={() => onSelect(date)}
              aria-label={`${label}${available ? `, ${info!.slotCount} times available` : ', unavailable'}`}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
