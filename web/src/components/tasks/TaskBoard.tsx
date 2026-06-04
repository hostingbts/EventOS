import type { Task } from '../../types';
import { StatusChip } from '../StatusChip';
import './TaskBoard.css';

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

interface Props {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
}

export function TaskBoard({ tasks, selectedTaskId, onSelect }: Props) {
  const columns: { status: string; label: string }[] = [
    { status: 'todo', label: 'To do' },
    { status: 'in_progress', label: 'In progress' },
    { status: 'blocked', label: 'Blocked' },
    { status: 'done', label: 'Done' },
  ];

  return (
    <div className="task-board">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="task-board__col">
            <h3>
              {col.label}
              <span>{colTasks.length}</span>
            </h3>
            <div className="task-board__list">
              {colTasks.map((task) => (
                <button
                  key={task.taskId}
                  type="button"
                  className={`task-card ${selectedTaskId === task.taskId ? 'task-card--selected' : ''}`}
                  onClick={() => onSelect(task.taskId)}
                >
                  <span className="task-card__cat">{task.category}</span>
                  <strong>{task.title}</strong>
                  {task.assigneeName && (
                    <span className="task-card__assignee">{task.assigneeName}</span>
                  )}
                  <StatusChip value={STATUS_LABEL[task.status] || task.status} kind="generic" />
                </button>
              ))}
              {colTasks.length === 0 && <p className="task-board__empty">No tasks</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
