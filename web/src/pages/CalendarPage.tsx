import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchEvents, fetchTeamOverview } from '../api/client';
import type { Event, TeamMember } from '../types';
import {
  assignEventLanes,
  buildMonthDays,
  endOfMonth,
  eventBarSpan,
  eventColorIndex,
  EVENT_BAR_PALETTE,
  getEventDateRange,
  startOfMonth,
  toIsoDate,
} from '../utils/calendarDates';
import './CalendarPage.css';

const DAY_COL_W = 44;
const LABEL_COL_W = 168;
const LANE_H = 34;

interface CalendarEvent {
  event: Event;
  start: string;
  end: string;
}

interface CalendarRow {
  key: string;
  label: string;
  email: string;
  events: CalendarEvent[];
}

function resolveCalendarEvents(events: Event[]): CalendarEvent[] {
  const resolved: CalendarEvent[] = [];
  for (const event of events) {
    const range = getEventDateRange(event);
    if (range) resolved.push({ event, start: range.start, end: range.end });
  }
  return resolved;
}

function buildRows(members: TeamMember[], events: CalendarEvent[]): CalendarRow[] {
  const nameByEmail = new Map<string, string>();
  for (const m of members) {
    if (m.email) nameByEmail.set(m.email.toLowerCase(), m.name);
  }

  const byOwner = new Map<string, CalendarEvent[]>();
  for (const item of events) {
    const email = item.event.ownerEmail?.trim().toLowerCase() || '';
    const key = email || '__unassigned__';
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(item);
  }

  // Include team members even if they have no events this month
  for (const m of members) {
    const email = m.email?.trim().toLowerCase();
    if (email && !byOwner.has(email)) byOwner.set(email, []);
  }

  const rows: CalendarRow[] = [];
  const emails = [...byOwner.keys()].filter((k) => k !== '__unassigned__').sort((a, b) => {
    const na = nameByEmail.get(a) ?? a;
    const nb = nameByEmail.get(b) ?? b;
    return na.localeCompare(nb);
  });

  for (const email of emails) {
    const evs = byOwner.get(email) ?? [];
    rows.push({
      key: email,
      email,
      label: nameByEmail.get(email) ?? email.split('@')[0],
      events: evs.sort((a, b) => a.start.localeCompare(b.start)),
    });
  }

  if (byOwner.has('__unassigned__')) {
    rows.push({
      key: '__unassigned__',
      email: '',
      label: 'Unassigned',
      events: byOwner.get('__unassigned__')!.sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
    });
  }

  return rows;
}

function eventsInMonth(events: CalendarEvent[], month: Date): CalendarEvent[] {
  const ms = toIsoDate(startOfMonth(month));
  const me = toIsoDate(endOfMonth(month));
  return events.filter((item) => item.start <= me && item.end >= ms);
}

export function CalendarPage() {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [evRes, teamRes] = await Promise.allSettled([
        fetchEvents(),
        fetchTeamOverview(),
      ]);
      if (cancelled) return;
      if (evRes.status === 'fulfilled') {
        setAllEvents(evRes.value.events ?? []);
      }
      if (teamRes.status === 'fulfilled') {
        setMembers(teamRes.value?.members ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => buildMonthDays(month), [month]);
  const calendarEvents = useMemo(() => resolveCalendarEvents(allEvents), [allEvents]);
  const monthEvents = useMemo(() => eventsInMonth(calendarEvents, month), [calendarEvents, month]);
  const rows = useMemo(() => buildRows(members, monthEvents), [members, monthEvents]);
  const undatedCount = allEvents.length - calendarEvents.length;

  const monthTitle = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1, 12, 0, 0, 0));
  }

  function nextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1, 12, 0, 0, 0));
  }

  function goToday() {
    setMonth(startOfMonth(new Date()));
  }

  if (loading) {
    return <p className="cal__loading">Loading calendar…</p>;
  }

  const gridCols = `${LABEL_COL_W}px repeat(${days.length}, ${DAY_COL_W}px)`;

  return (
    <div className="cal">
      <header className="cal__header">
        <div>
          <h1 className="cal__title">Calendar</h1>
          <p className="cal__sub">Events by assigned member — {monthEvents.length} this month</p>
        </div>
        <div className="cal__nav">
          <button type="button" className="cal__nav-btn" onClick={prevMonth} aria-label="Previous month">
            ‹
          </button>
          <span className="cal__month">{monthTitle}</span>
          <button type="button" className="cal__nav-btn" onClick={nextMonth} aria-label="Next month">
            ›
          </button>
          <button type="button" className="cal__today-btn" onClick={goToday}>
            Today
          </button>
        </div>
      </header>

      <div className="cal__board-wrap">
        <div className="cal__board" style={{ minWidth: LABEL_COL_W + days.length * DAY_COL_W }}>
          {/* Day header row */}
          <div className="cal__head-row" style={{ gridTemplateColumns: gridCols }}>
            <div className="cal__head-label" />
            {days.map((d) => (
              <div
                key={d.iso}
                className={`cal__head-day${d.isWeekend ? ' cal__head-day--weekend' : ''}${d.isToday ? ' cal__head-day--today' : ''}`}
              >
                <span className="cal__head-dow">{d.weekday}</span>
                <span className="cal__head-num">{d.dayNum}</span>
              </div>
            ))}
          </div>

          {/* Member rows */}
          {monthEvents.length === 0 ? (
            <p className="cal__empty">No events with dates in {monthTitle}.</p>
          ) : (
            rows
              .filter((row) => row.events.length > 0)
              .map((row) => {
              const laneInput = row.events
                .map((item) => ({
                  id: item.event.rowId,
                  start: item.start,
                  end: item.end,
                }))
                .filter((e) => eventBarSpan(e.start, e.end, days));
              const lanes = assignEventLanes(laneInput);
              const maxLane = laneInput.length
                ? Math.max(...laneInput.map((e) => lanes.get(e.id) ?? 0))
                : 0;
              const rowH = Math.max(48, (maxLane + 1) * LANE_H + 12);

              return (
                <div
                  key={row.key}
                  className="cal__row"
                  style={{ gridTemplateColumns: gridCols, minHeight: rowH }}
                >
                  <div className="cal__row-label">
                    <span className="cal__avatar" aria-hidden="true">
                      {row.label.charAt(0).toUpperCase()}
                    </span>
                    <span className="cal__member-name">{row.label}</span>
                  </div>

                  <div
                    className="cal__row-grid"
                    style={{
                      gridColumn: `2 / span ${days.length}`,
                      gridTemplateColumns: `repeat(${days.length}, ${DAY_COL_W}px)`,
                      minHeight: rowH,
                    }}
                  >
                    {days.map((d) => (
                      <div
                        key={d.iso}
                        className={`cal__cell${d.isWeekend ? ' cal__cell--weekend' : ''}${d.isToday ? ' cal__cell--today' : ''}`}
                      />
                    ))}

                    {row.events.map((item) => {
                      const ev = item.event;
                      const span = eventBarSpan(item.start, item.end, days);
                      if (!span) return null;
                      const lane = lanes.get(ev.rowId) ?? 0;
                      const pal = EVENT_BAR_PALETTE[eventColorIndex(ev.code)];
                      const startIdx = span.startCol - 2;
                      return (
                        <Link
                          key={ev.rowId}
                          to={`/event/${encodeURIComponent(ev.code)}`}
                          className="cal__bar"
                          style={{
                            gridColumn: `${startIdx + 1} / span ${span.span}`,
                            gridRow: 1,
                            marginTop: 6 + lane * LANE_H,
                            background: pal.bg,
                            borderColor: pal.border,
                            color: pal.text,
                          }}
                          title={`${ev.code} — ${ev.location || ev.dates}`}
                        >
                          <span className="cal__bar-code">{ev.code}</span>
                          <span className="cal__bar-sub">{ev.location || ev.dates}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {undatedCount > 0 && (
        <p className="cal__note">
          {undatedCount} event{undatedCount === 1 ? '' : 's'} without start dates — shown on the{' '}
          <Link to="/">Events</Link> list only.
        </p>
      )}
    </div>
  );
}
