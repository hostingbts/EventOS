import type { Event, EventHealth, Task, TaskFile } from '../types';

function isMissing(value: string | undefined): boolean {
  if (!value) return true;
  const s = value.trim().toLowerCase();
  return !s || s === '??' || s === 'n/a' || s === '-';
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Computes a completion percentage and a risk score for an event based on its
 * tasks, files, and field completeness. Used for the health dashboard and
 * `EventCard` progress bars.
 */
export function computeEventHealth(
  event: Event,
  tasks: Task[] = [],
  files: TaskFile[] = [],
): EventHealth {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const openTasks = tasks.filter((t) => t.status !== 'done').length;
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'done') return false;
    const due = daysUntil(t.dueDate);
    return due !== null && due < 0;
  }).length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;

  const completion =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const signals: string[] = [];
  let risk = 0;

  if (isMissing(event.sow)) {
    signals.push('Missing SOW');
    risk += 18;
  }
  if (isMissing(event.venue)) {
    signals.push('Missing venue');
    risk += 16;
  }
  const lemOpen = event.lem && event.lem.trim().toLowerCase() !== 'closed';
  if (lemOpen) {
    signals.push('LEM still open');
    risk += 8;
  }
  if (overdueTasks > 0) {
    signals.push(`${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''}`);
    risk += Math.min(30, overdueTasks * 10);
  }
  if (blockedTasks > 0) {
    signals.push(`${blockedTasks} blocked task${blockedTasks > 1 ? 's' : ''}`);
    risk += Math.min(15, blockedTasks * 5);
  }
  if (totalTasks === 0) {
    signals.push('No tasks yet');
    risk += 10;
  }
  if (totalTasks > 0 && files.length === 0) {
    signals.push('No files attached');
    risk += 6;
  }

  // Time pressure
  const daysLeft = daysUntil(event.startDate);
  if (daysLeft !== null) {
    if (daysLeft < 0 && completion < 100) {
      signals.push('Event has started/passed with open tasks');
      risk += 25;
    } else if (daysLeft <= 7 && completion < 70) {
      signals.push('Less than a week away');
      risk += 18;
    } else if (daysLeft <= 21 && completion < 50) {
      signals.push('Less than 3 weeks away');
      risk += 10;
    }
  }

  risk = Math.max(0, Math.min(100, risk));

  let tier: EventHealth['tier'];
  if (risk >= 60) tier = 'critical';
  else if (risk >= 35) tier = 'at-risk';
  else if (risk >= 15) tier = 'attention';
  else tier = 'on-track';

  return {
    completion,
    risk,
    tier,
    totalTasks,
    doneTasks,
    openTasks,
    overdueTasks,
    signals,
  };
}

/** Aggregates per-event health into a portfolio summary for the dashboard. */
export function summariseHealth(items: EventHealth[]) {
  const total = items.length;
  if (!total) {
    return { total: 0, avgCompletion: 0, critical: 0, atRisk: 0, attention: 0, onTrack: 0 };
  }
  const avgCompletion = Math.round(items.reduce((sum, h) => sum + h.completion, 0) / total);
  return {
    total,
    avgCompletion,
    critical: items.filter((h) => h.tier === 'critical').length,
    atRisk: items.filter((h) => h.tier === 'at-risk').length,
    attention: items.filter((h) => h.tier === 'attention').length,
    onTrack: items.filter((h) => h.tier === 'on-track').length,
  };
}
