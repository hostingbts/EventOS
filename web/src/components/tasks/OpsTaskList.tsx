/**
 * OpsTaskList — Category-grouped operational task list with one-click completion.
 *
 * - Tasks grouped by operational category (AV, Venue, Interpretation…)
 * - Completion checkbox: only the assigned team member (or an admin) can tick done
 * - Admins can also un-complete a task by clicking the filled checkbox
 */
import type { Task } from '../../types';
import { getCategory, OPS_CATEGORIES } from '../../utils/categories';
import './OpsTaskList.css';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  todo:        { label: 'To do',       cls: 'status--todo' },
  in_progress: { label: 'In progress', cls: 'status--progress' },
  blocked:     { label: 'Blocked',     cls: 'status--blocked' },
  done:        { label: 'Done',        cls: 'status--done' },
};

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function DueBadge({ dueDate, done }: { dueDate: string; done: boolean }) {
  const days = daysUntil(dueDate);
  if (days === null || done) return null;
  if (days < 0) return <span className="ops-due ops-due--overdue">⚠ {Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="ops-due ops-due--today">Due today</span>;
  if (days <= 3) return <span className="ops-due ops-due--soon">In {days}d</span>;
  return (
    <span className="ops-due ops-due--ok">
      {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
    </span>
  );
}

interface Props {
  tasks: Task[];
  selectedTaskId: string | null;
  /** Email of the currently signed-in user (null = not logged in). */
  currentUserEmail: string | null;
  isAdmin: boolean;
  onSelect: (taskId: string) => void;
  /** Called when the completion checkbox is toggled. */
  onToggleComplete: (task: Task) => void;
}

export function OpsTaskList({
  tasks,
  selectedTaskId,
  currentUserEmail,
  isAdmin,
  onSelect,
  onToggleComplete,
}: Props) {
  // Group tasks by category, preserving operational category order
  const ordered = OPS_CATEGORIES.map((cat) => ({
    cat,
    tasks: tasks.filter((t) => (t.category || 'General').toLowerCase() === cat.id.toLowerCase()),
  })).filter((g) => g.tasks.length > 0);

  // Catch tasks with unrecognised categories
  const knownIds = new Set(OPS_CATEGORIES.map((c) => c.id.toLowerCase()));
  const unknown = tasks.filter((t) => !knownIds.has((t.category || '').toLowerCase()));
  if (unknown.length) ordered.push({ cat: getCategory('General'), tasks: unknown });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const overdue = tasks.filter((t) => {
    if (t.status === 'done') return false;
    const d = daysUntil(t.dueDate);
    return d !== null && d < 0;
  }).length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;

  return (
    <div className="ops-list">
      {/* ── Summary bar ── */}
      <div className="ops-list__summary">
        <span className="ops-summary-pill ops-summary-pill--total">
          {total} task{total !== 1 ? 's' : ''}
        </span>
        <span className="ops-summary-pill ops-summary-pill--done">{done} complete</span>
        {blocked > 0 && (
          <span className="ops-summary-pill ops-summary-pill--blocked">{blocked} blocked</span>
        )}
        {overdue > 0 && (
          <span className="ops-summary-pill ops-summary-pill--overdue">{overdue} overdue</span>
        )}
        <div className="ops-list__bar">
          <div
            className="ops-list__bar-fill"
            style={{ width: total ? `${Math.round((done / total) * 100)}%` : '0%' }}
          />
        </div>
        <span className="ops-list__pct">{total ? Math.round((done / total) * 100) : 0}%</span>
      </div>

      {/* ── Column header ── */}
      <div className="ops-list__col-head">
        <span />
        <span>Task</span>
        <span>Assigned to</span>
        <span>Due</span>
        <span>Status</span>
      </div>

      {/* ── Category groups ── */}
      {ordered.map(({ cat, tasks: catTasks }) => {
        const catDone = catTasks.filter((t) => t.status === 'done').length;
        const allDone = catDone === catTasks.length;

        return (
          <div key={cat.id} className={`ops-group ${allDone ? 'ops-group--done' : ''}`}>
            <div className="ops-group__header">
              <span className="ops-group__dot" style={{ background: cat.color }} aria-hidden="true" />
              <span className="ops-group__emoji" aria-hidden="true">{cat.emoji}</span>
              <span className="ops-group__label" style={{ color: cat.color }}>{cat.label}</span>
              <span className="ops-group__count">{catDone}/{catTasks.length}</span>
              <div className="ops-group__bar">
                <div
                  className="ops-group__bar-fill"
                  style={{ width: `${Math.round((catDone / catTasks.length) * 100)}%`, background: cat.color }}
                />
              </div>
            </div>

            <ul className="ops-group__tasks">
              {catTasks.map((task) => {
                const isDone = task.status === 'done';
                const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
                const isSelected = selectedTaskId === task.taskId;

                // Who can tick this task done?
                const isAssignee = currentUserEmail && task.assigneeEmail
                  ? task.assigneeEmail.toLowerCase() === currentUserEmail.toLowerCase()
                  : false;
                const canComplete = isAdmin || isAssignee;

                // Tooltip for the checkbox
                const checkTip = isDone
                  ? (isAdmin ? 'Re-open task (admin override)' : `Completed by ${task.completedBy || 'unknown'}`)
                  : canComplete
                    ? 'Mark as complete'
                    : task.assigneeName
                      ? `Only ${task.assigneeName} can complete this task`
                      : 'Assign this task first, then mark complete';

                return (
                  <li key={task.taskId} className={isDone ? 'ops-li--done' : ''}>
                    {/* Completion checkbox */}
                    <button
                      type="button"
                      className={`ops-check ${isDone ? 'ops-check--done' : ''} ${!canComplete && !isDone ? 'ops-check--locked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canComplete || (isDone && isAdmin)) onToggleComplete(task);
                      }}
                      title={checkTip}
                      aria-label={checkTip}
                      disabled={!canComplete && !isDone}
                    >
                      {isDone ? (
                        <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <circle cx="7" cy="7" r="7" fill="currentColor" opacity="0.15"/>
                          <path d="M3.5 7L6 9.5L10.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      )}
                    </button>

                    {/* Row button — opens detail panel */}
                    <button
                      type="button"
                      className={`ops-task ${isSelected ? 'ops-task--selected' : ''} ${isDone ? 'ops-task--done' : ''}`}
                      onClick={() => onSelect(task.taskId)}
                      style={isSelected ? { borderLeftColor: cat.color } : undefined}
                    >
                      {/* Title + instructions preview */}
                      <span className="ops-task__body">
                        <span className="ops-task__title">{task.title}</span>
                        {task.instructions && (
                          <span className="ops-task__preview">{task.instructions.split('\n')[0]}</span>
                        )}
                      </span>

                      {/* Assignee */}
                      <span className="ops-task__assignee-cell">
                        {task.assigneeName ? (
                          <span className="ops-task__assignee-chip">
                            <span className="ops-task__assignee-avatar">
                              {task.assigneeName.charAt(0).toUpperCase()}
                            </span>
                            {task.assigneeName}
                          </span>
                        ) : (
                          <span className="ops-task__unassigned">Unassigned</span>
                        )}
                      </span>

                      {/* Due date */}
                      <span className="ops-task__due-cell">
                        <DueBadge dueDate={task.dueDate} done={isDone} />
                        {isDone && task.completedAt && (
                          <span className="ops-due ops-due--completed">
                            ✓ {new Date(task.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </span>

                      {/* Status badge */}
                      <span className={`ops-task__status ${sc.cls}`}>{sc.label}</span>

                      {/* Vendor indicator */}
                      {task.vendorVisible === 'yes' && (
                        <span className="ops-task__vendor" title="Shared with vendor">🔗</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
