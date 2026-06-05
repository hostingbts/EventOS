/** Calendar grid helpers for the team timeline view. */

export interface CalendarDay {
  date: Date;
  iso: string;
  dayNum: number;
  weekday: string;
  isWeekend: boolean;
  isToday: boolean;
}

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function parseIsoDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + (s.length === 10 ? 'T12:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayAtNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function buildMonthDays(month: Date): CalendarDay[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const todayIso = toIsoDate(todayAtNoon());
  const days: CalendarDay[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const copy = new Date(d);
    copy.setHours(12, 0, 0, 0);
    const iso = toIsoDate(copy);
    const dow = copy.getDay();
    days.push({
      date: copy,
      iso,
      dayNum: copy.getDate(),
      weekday: WEEKDAY[dow],
      isWeekend: dow === 0 || dow === 6,
      isToday: iso === todayIso,
    });
  }
  return days;
}

/** Inclusive day index within a month grid (1-based column for CSS grid). */
export function dayColumn(iso: string, days: CalendarDay[]): number | null {
  const idx = days.findIndex((d) => d.iso === iso);
  return idx >= 0 ? idx + 2 : null; // +2: column 1 is the label
}

/** Clamp event range to visible month; returns [startCol, span] or null if no overlap. */
export function eventBarSpan(
  startIso: string,
  endIso: string,
  days: CalendarDay[],
): { startCol: number; span: number } | null {
  if (!days.length) return null;
  const monthStart = days[0].iso;
  const monthEnd = days[days.length - 1].iso;
  const start = startIso < monthStart ? monthStart : startIso;
  const end = (endIso || startIso) > monthEnd ? monthEnd : endIso || startIso;
  if (start > monthEnd || end < monthStart) return null;

  const startIdx = days.findIndex((d) => d.iso === start);
  const endIdx = days.findIndex((d) => d.iso === end);
  const s = startIdx >= 0 ? startIdx : 0;
  const e = endIdx >= 0 ? endIdx : days.length - 1;
  return { startCol: s + 2, span: e - s + 1 };
}

/** Assign vertical lanes for overlapping events on one row. */
export function assignEventLanes(
  events: Array<{ id: string; start: string; end: string }>,
): Map<string, number> {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const laneEnds: string[] = [];
  const map = new Map<string, number>();

  for (const ev of sorted) {
    const start = ev.start;
    const end = ev.end || ev.start;
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] >= start) lane++;
    laneEnds[lane] = end;
    map.set(ev.id, lane);
  }
  return map;
}

export const EVENT_BAR_PALETTE = [
  { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
  { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
  { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
  { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  { bg: '#fef9c3', border: '#facc15', text: '#854d0e' },
  { bg: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
  { bg: '#ccfbf1', border: '#2dd4bf', text: '#115e59' },
  { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' },
] as const;

export function eventColorIndex(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h + code.charCodeAt(i) * (i + 1)) % EVENT_BAR_PALETTE.length;
  return h;
}
