import type { Event, EventHealth } from '../types';
import { StatusChip } from './StatusChip';
import './EventCard.css';

interface Props {
  event: Event;
  health?: EventHealth | null;
  selected?: boolean;
  onSelect?: () => void;
  static?: boolean;
}

export function EventCard({ event, health, selected = false, onSelect, static: isStatic }: Props) {
  const className = `event-card ${selected ? 'event-card--selected' : ''} ${
    health ? `event-card--tier-${health.tier}` : ''
  }`;

  const showHealth = !!health;

  const content = (
    <>
      <div className="event-card__top">
        <span className="event-card__code">{event.code}</span>
        {showHealth ? (
          <span className={`event-card__tier event-card__tier--${health!.tier}`}>
            {health!.tier === 'on-track' && 'On track'}
            {health!.tier === 'attention' && 'Attention'}
            {health!.tier === 'at-risk' && 'At risk'}
            {health!.tier === 'critical' && 'Critical'}
          </span>
        ) : null}
      </div>
      <div className="event-card__location">{event.location || '—'}</div>
      <div className="event-card__dates">{event.dates}</div>

      {showHealth && (
        <div className="event-card__health" title={health!.signals.join(' · ') || 'On track'}>
          <div className="event-card__health-bar">
            <div
              className="event-card__health-fill"
              style={{ width: `${health!.completion}%` }}
            />
          </div>
          <div className="event-card__health-meta">
            <span>
              <strong>{health!.completion}%</strong> complete
            </span>
            <span>
              {health!.doneTasks}/{health!.totalTasks} tasks
              {health!.overdueTasks > 0 && (
                <span className="event-card__overdue"> · {health!.overdueTasks} overdue</span>
              )}
            </span>
          </div>
        </div>
      )}

      <div className="event-card__chips">
        <StatusChip value={event.lem} kind="lem" />
        <StatusChip value={event.av} kind="av" />
        <StatusChip value={event.interpreters} kind="interpreters" />
      </div>
    </>
  );

  if (isStatic) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" className={className} onClick={onSelect}>
      {content}
    </button>
  );
}
