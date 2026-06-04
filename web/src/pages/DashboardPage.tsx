import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchDashboardHealth, fetchEvents } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Event, EventHealth } from '../types';
import { NewProjectModal } from '../components/NewProjectModal';
import { summariseHealth } from '../utils/health';
import './DashboardPage.css';

type Filter = 'all' | 'attention' | 'missing-sow' | 'missing-venue' | 'critical';

// ─── Date helpers ─────────────────────────────────────────────────────────────

const COMPLETED_THRESHOLD = 15; // days past endDate → completed
const IMMINENT_DAYS = 7;        // days until startDate → imminent row highlight

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isCompleted(ev: Event, archivedCodes: Set<string>): boolean {
  if (archivedCodes.has(ev.code)) return true;
  const end = parseDate(ev.endDate);
  if (!end) return false;
  return Math.floor((today().getTime() - end.getTime()) / 86_400_000) > COMPLETED_THRESHOLD;
}

function daysUntilStart(ev: Event): number | null {
  const s = parseDate(ev.startDate);
  if (!s) return null;
  return Math.floor((s.getTime() - today().getTime()) / 86_400_000);
}

function isHappening(ev: Event): boolean {
  const s = parseDate(ev.startDate);
  const e = parseDate(ev.endDate);
  const t = today();
  if (!s) return false;
  if (s > t) return false;
  if (e && e < t) return false;
  return true;
}

/** Derive "Month YYYY" label from a startDate ISO string. */
function monthLabel(startDate: string | undefined, fallback: string): string {
  const d = parseDate(startDate ?? '');
  if (!d) return fallback || 'Unscheduled';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Group events by month and sort:
 *  - months chronologically (earliest first for active, latest first for completed)
 *  - events within each month by startDate ascending
 */
function groupByMonth(
  events: Event[],
  monthOrder: 'asc' | 'desc' = 'asc',
): Array<{ month: string; events: Event[] }> {
  const map = new Map<string, { events: Event[]; anchor: Date }>();

  for (const ev of events) {
    const label = monthLabel(ev.startDate, ev.monthGroup);
    const anchor = parseDate(ev.startDate) ?? new Date(0);
    if (!map.has(label)) map.set(label, { events: [], anchor });
    map.get(label)!.events.push(ev);
  }

  // Sort events within each month by startDate ascending
  for (const bucket of map.values()) {
    bucket.events.sort((a, b) => {
      const da = parseDate(a.startDate);
      const db = parseDate(b.startDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
    // Update anchor to first event's date for reliable month ordering
    const first = parseDate(bucket.events[0]?.startDate);
    if (first) bucket.anchor = first;
  }

  // Sort months
  const entries = Array.from(map.entries()).sort(([, a], [, b]) => {
    const diff = a.anchor.getTime() - b.anchor.getTime();
    return monthOrder === 'asc' ? diff : -diff;
  });

  return entries.map(([month, { events: evs }]) => ({ month, events: evs }));
}

function matchesFilter(ev: Event, filter: Filter, health?: EventHealth | null): boolean {
  if (filter === 'all') return true;
  const sow = ev.sow?.trim().toLowerCase();
  const missingSow = !sow || sow === '??';
  const missingVenue = !ev.venue?.trim();
  const lemOpen = ev.lem?.trim().toLowerCase() !== 'closed';
  if (filter === 'attention') return missingSow || missingVenue || lemOpen;
  if (filter === 'missing-sow') return missingSow;
  if (filter === 'missing-venue') return missingVenue;
  if (filter === 'critical') return health?.tier === 'critical' || health?.tier === 'at-risk';
  return true;
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

interface RowProps {
  ev: Event;
  health?: EventHealth | null;
  isCompleted: boolean;
  isAdmin: boolean;
  onArchive: (code: string) => void;
  onUnarchive: (code: string) => void;
}

function EventRow({ ev, health, isCompleted: done, isAdmin, onArchive, onUnarchive }: RowProps) {
  const tier = health?.tier ?? null;
  const pending = health ? health.totalTasks - health.doneTasks : null;
  const days = daysUntilStart(ev);
  const happening = isHappening(ev);
  const imminent = !done && days !== null && days <= IMMINENT_DAYS;

  return (
    <div className={`dashboard__row-wrap${imminent ? ' dashboard__row-wrap--imminent' : ''}${happening ? ' dashboard__row-wrap--happening' : ''}`}>
      <Link
        to={`/event/${encodeURIComponent(ev.code)}`}
        className={`dashboard__row dashboard__row--${tier ?? 'none'}`}
      >
        <span className="dashboard__row-bar" aria-hidden="true" />

        {/* Event code */}
        <span className="dl-code">
          {ev.code}
          {!ev.venue && <span className="dl-flag" title="No venue confirmed">!</span>}
        </span>

        {/* Location + dates */}
        <span className="dl-location">
          <span className="dl-location__place">{ev.location || '—'}</span>
          <span className="dl-location__dates">
            {ev.dates || '—'}
            {happening && (
              <span className="dl-badge dl-badge--happening">● Now</span>
            )}
            {!happening && imminent && days === 0 && (
              <span className="dl-badge dl-badge--imminent">Today</span>
            )}
            {!happening && imminent && days !== null && days > 0 && (
              <span className="dl-badge dl-badge--imminent">In {days}d</span>
            )}
            {!happening && !imminent && days !== null && days < 0 && days > -COMPLETED_THRESHOLD && (
              <span className="dl-badge dl-badge--concluded">{Math.abs(days)}d ago</span>
            )}
          </span>
        </span>

        {/* Owner */}
        <span className="dl-owner">
          {ev.ownerEmail ? (
            <span className="dl-owner__chip">
              <span className="dl-owner__avatar">{ev.ownerEmail.charAt(0).toUpperCase()}</span>
              <span className="dl-owner__name">{ev.ownerEmail.split('@')[0]}</span>
            </span>
          ) : (
            <span className="dl-owner__none">—</span>
          )}
        </span>

        {/* Progress */}
        <span className="dl-progress">
          {health ? (
            <>
              <span className="dl-progress__track">
                <span
                  className={`dl-progress__fill dl-progress__fill--${tier}`}
                  style={{ width: `${health.completion}%` }}
                />
              </span>
              <span className="dl-progress__pct">{health.completion}%</span>
            </>
          ) : (
            <span className="dl-progress__na">—</span>
          )}
        </span>

        {/* Tasks */}
        <span className="dl-tasks">
          {health ? (
            <>
              <span className="dl-tasks__done">{health.doneTasks}/{health.totalTasks}</span>
              {pending !== null && pending > 0 && (
                <span className="dl-tasks__pending">{pending} left</span>
              )}
              {health.overdueTasks > 0 && (
                <span className="dl-tasks__overdue">⚠ {health.overdueTasks}</span>
              )}
            </>
          ) : (
            <span className="dl-tasks__none">—</span>
          )}
        </span>

        {/* Status */}
        <span className={`dl-status dl-status--${tier ?? 'none'}`}>
          {tier === 'on-track' && 'On track'}
          {tier === 'attention' && 'Attention'}
          {tier === 'at-risk' && 'At risk'}
          {tier === 'critical' && 'Critical'}
          {!tier && '—'}
        </span>

        <span className="dl-arrow" aria-hidden="true">→</span>
      </Link>

      {/* Admin archive toggle */}
      {isAdmin && (
        <button
          type="button"
          className={`dl-archive-btn${done ? ' dl-archive-btn--restore' : ''}`}
          title={done ? 'Restore to active' : 'Archive event'}
          onClick={(e) => {
            e.preventDefault();
            done ? onUnarchive(ev.code) : onArchive(ev.code);
          }}
        >
          {done ? '↩' : '⊙'}
        </button>
      )}
    </div>
  );
}

// ─── Month section ────────────────────────────────────────────────────────────

interface MonthSectionProps {
  month: string;
  events: Event[];
  healthByCode: Record<string, EventHealth>;
  isCompleted: boolean;
  isAdmin: boolean;
  onArchive: (code: string) => void;
  onUnarchive: (code: string) => void;
}

function MonthSection({ month, events, healthByCode, isCompleted, isAdmin, onArchive, onUnarchive }: MonthSectionProps) {
  return (
    <div className="dashboard__month-group">
      <h2 className="dashboard__month-heading">
        <span className="dmh-label">{month}</span>
        <span className="dmh-count">{events.length}</span>
      </h2>
      <div className="dashboard__list">
        <div className="dashboard__list-head">
          <span className="dlh-code">Event</span>
          <span className="dlh-location">Location · Dates</span>
          <span className="dlh-owner">Owner</span>
          <span className="dlh-progress">Readiness</span>
          <span className="dlh-tasks">Tasks</span>
          <span className="dlh-status">Status</span>
        </div>
        {events.map((ev) => (
          <EventRow
            key={ev.rowId}
            ev={ev}
            health={healthByCode[ev.code]}
            isCompleted={isCompleted}
            isAdmin={isAdmin}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, isAdmin } = useUser();
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [healthByCode, setHealthByCode] = useState<Record<string, EventHealth>>({});
  const [completedOpen, setCompletedOpen] = useState(false);

  const [archivedCodes, setArchivedCodes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('archived_events');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, health] = await Promise.all([fetchEvents(), fetchDashboardHealth()]);
      setEvents(data.events);
      setHealthByCode(health);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function archive(code: string) {
    setArchivedCodes((prev) => {
      const next = new Set([...prev, code]);
      localStorage.setItem('archived_events', JSON.stringify([...next]));
      return next;
    });
  }

  function unarchive(code: string) {
    setArchivedCodes((prev) => {
      const next = new Set([...prev].filter((c) => c !== code));
      localStorage.setItem('archived_events', JSON.stringify([...next]));
      return next;
    });
  }

  // Split events into active / completed
  const { activeEvents, completedEvents } = useMemo(() => {
    const active: Event[] = [];
    const completed: Event[] = [];
    for (const ev of events) {
      (isCompleted(ev, archivedCodes) ? completed : active).push(ev);
    }
    return { activeEvents: active, completedEvents: completed };
  }, [events, archivedCodes]);

  // Apply filter to active events only
  const filteredActive = useMemo(
    () => activeEvents.filter((e) => matchesFilter(e, filter, healthByCode[e.code])),
    [activeEvents, filter, healthByCode],
  );

  // Group & sort
  const activeGroups = useMemo(() => groupByMonth(filteredActive, 'asc'), [filteredActive]);
  const completedGroups = useMemo(() => groupByMonth(completedEvents, 'desc'), [completedEvents]);

  // KPI summary (active only)
  const summary = useMemo(() => {
    const hs = activeEvents
      .map((e) => healthByCode[e.code])
      .filter((h): h is EventHealth => Boolean(h));
    return summariseHealth(hs);
  }, [activeEvents, healthByCode]);

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard__header">
        <div>
          <h1>Event Operations</h1>
          <p>Operational execution — tasks, accountability, and vendor coordination.</p>
        </div>
        <div className="dashboard__header-actions">
          <button type="button" className="dashboard__refresh" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {user && (
            <button type="button" className="dashboard__new" onClick={() => setShowNewProject(true)}>
              + New event
            </button>
          )}
        </div>
      </header>

      {/* KPI cards */}
      {summary.total > 0 && (
        <section className="dashboard__health">
          <div className="dashboard__health-row">
            <div className="dashboard__health-card">
              <small>Portfolio completion</small>
              <strong>{summary.avgCompletion}%</strong>
              <div className="dashboard__health-bar">
                <div className="dashboard__health-fill" style={{ width: `${summary.avgCompletion}%` }} />
              </div>
            </div>
            <div className="dashboard__health-card">
              <small>On track</small>
              <strong className="ok">{summary.onTrack}</strong>
              <span>of {summary.total}</span>
            </div>
            <div className="dashboard__health-card">
              <small>Need attention</small>
              <strong className="warn">{summary.attention}</strong>
              <span>events</span>
            </div>
            <div className="dashboard__health-card">
              <small>At risk / critical</small>
              <strong className="bad">{summary.atRisk + summary.critical}</strong>
              <span>{summary.critical > 0 ? `${summary.critical} critical` : 'events'}</span>
            </div>
          </div>
        </section>
      )}

      {/* Toolbar */}
      <div className="dashboard__toolbar">
        {(
          [
            ['all', 'All active'],
            ['attention', 'Needs attention'],
            ['critical', 'At risk'],
            ['missing-sow', 'Missing SOW'],
            ['missing-venue', 'Missing venue'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? 'active' : ''}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <span className="dashboard__toolbar-count">
          {filteredActive.length} event{filteredActive.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <p className="dashboard__msg">Loading events…</p>}
      {error && <p className="dashboard__msg dashboard__msg--err">{error}</p>}

      {!loading && events.length === 0 && (
        <div className="dashboard__empty">
          <p>No events yet.</p>
          {user && (
            <button type="button" className="dashboard__new" onClick={() => setShowNewProject(true)}>
              + Create first event
            </button>
          )}
        </div>
      )}

      {/* Active events — month sections */}
      {activeGroups.map(({ month, events: monthEvents }) => (
        <MonthSection
          key={month}
          month={month}
          events={monthEvents}
          healthByCode={healthByCode}
          isCompleted={false}
          isAdmin={isAdmin}
          onArchive={archive}
          onUnarchive={unarchive}
        />
      ))}

      {!loading && filteredActive.length === 0 && activeEvents.length > 0 && (
        <p className="dashboard__msg">No active events match the current filter.</p>
      )}

      {/* Completed events — collapsible, grouped by month */}
      {completedGroups.length > 0 && (
        <div className="dashboard__completed">
          <button
            type="button"
            className="dashboard__completed-toggle"
            onClick={() => setCompletedOpen((o) => !o)}
            aria-expanded={completedOpen}
          >
            <span className={`dc-chevron${completedOpen ? ' dc-chevron--open' : ''}`} aria-hidden="true">›</span>
            Completed events
            <span className="dc-count">{completedEvents.length}</span>
            <span className="dc-hint">{completedOpen ? 'Collapse' : 'Expand'}</span>
          </button>

          {completedOpen && (
            <div className="dashboard__completed-body">
              {completedGroups.map(({ month, events: monthEvents }) => (
                <MonthSection
                  key={month}
                  month={month}
                  events={monthEvents}
                  healthByCode={healthByCode}
                  isCompleted
                  isAdmin={isAdmin}
                  onArchive={archive}
                  onUnarchive={unarchive}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showNewProject && user && (
        <NewProjectModal
          actorEmail={user.email}
          onClose={() => setShowNewProject(false)}
          onCreated={(code) => {
            setShowNewProject(false);
            navigate(`/event/${encodeURIComponent(code)}`);
          }}
        />
      )}
    </div>
  );
}
