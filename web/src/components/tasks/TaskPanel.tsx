import React, { useEffect, useState } from 'react';
import type { Comment, Task, TaskFile } from '../../types';
import { TASK_STATUSES, updateTask, uploadTaskFile, deleteTaskFile } from '../../api/client';
import { useUser } from '../../context/UserContext';
import { getCategory } from '../../utils/categories';
import { getTransferListMeta } from '../../utils/transferListStore';
import { formatIsoDate } from '../../utils/dateFormat';
import { DateInput } from '../DateInput';
import { CommentThread } from '../collaboration/CommentThread';
import { TaskFileUpload } from './TaskFileUpload';
import './TaskPanel.css';

interface Props {
  task: Task | null;
  comments: Comment[];
  files: TaskFile[];
  onTaskUpdated: (task: Task) => void;
  onCommentAdded: (comment: Comment) => void;
  onFileAdded: (file: TaskFile) => void;
  onFileRemoved: (fileId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  todo:        { label: 'To do',       cls: 'status--todo' },
  in_progress: { label: 'In progress', cls: 'status--progress' },
  blocked:     { label: 'Blocked',     cls: 'status--blocked' },
  done:        { label: 'Done',        cls: 'status--done' },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1_048_576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1_048_576).toFixed(1) + ' MB';
}

/** Extracts the /per-diem-form URL from rendered template instructions. */
function buildPerDiemUrl(instructions: string): string {
  const match = instructions.match(/(\/per-diem-form[^\s\n]*)/);
  return match ? match[1] : '/per-diem-form';
}

/** Extracts the /transfer-list URL from rendered template instructions. */
function buildTransferUrl(instructions: string): string {
  const match = instructions.match(/(\/transfer-list[^\s\n]*)/);
  return match ? match[1] : '/transfer-list';
}

/** Renders a single instruction line, turning bare URLs into anchor tags. */
function renderInstructionLine(line: string): React.ReactNode {
  const urlRe = /(https?:\/\/[^\s]+|\/per-diem-form[^\s]*|\/transfer-list[^\s]*)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const href = m[0];
    parts.push(
      <a key={m.index} href={href} target="_blank" rel="noreferrer" className="task-panel__instr-link">
        {href}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts.length ? parts : line;
}

function daysLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const formatted = formatIsoDate(dateStr);
  if (diff < 0) return `${formatted} — ${Math.abs(diff)}d overdue`;
  if (diff === 0) return `${formatted} — Due today`;
  if (diff <= 3) return `${formatted} — In ${diff}d`;
  return formatted;
}

export function TaskPanel({
  task,
  comments,
  files,
  onTaskUpdated,
  onCommentAdded,
  onFileAdded,
  onFileRemoved,
}: Props) {
  const { user, isAdmin } = useUser();
  const [uploading, setUploading] = useState(false);
  const [editNotes, setEditNotes] = useState(false);
  const [notesVal, setNotesVal] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [tlMeta, setTlMeta] = useState<{ savedAt: string; travelerCount: number; savedBy: string } | null>(null);

  // Refresh transfer-list save metadata whenever the task changes
  useEffect(() => {
    if (task?.templateId === 'tpl-transfer' && task.eventCode) {
      setTlMeta(getTransferListMeta(task.eventCode));
    } else {
      setTlMeta(null);
    }
  }, [task?.taskId, task?.templateId, task?.eventCode]);

  if (!task) {
    return (
      <div className="task-panel task-panel--empty">
        <div className="task-panel__empty-icon" aria-hidden="true">📋</div>
        <strong>Select an operational task</strong>
        <p>Click any task on the left to view instructions, upload files, and track status.</p>
      </div>
    );
  }

  const t = task;
  const cat = getCategory(t.category);
  const isAssignee = !!(user && t.assigneeEmail &&
    t.assigneeEmail.toLowerCase() === user.email.toLowerCase());
  const canComplete = isAdmin || isAssignee;
  const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.todo;
  const taskComments = comments.filter((c) => c.taskId === t.taskId);
  const taskFiles = files.filter((f) => f.taskId === t.taskId);
  const dueDays = t.dueDate
    ? Math.round(
        (new Date(t.dueDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86_400_000,
      )
    : null;
  const dueOverdue = dueDays !== null && dueDays < 0 && t.status !== 'done';

  async function handleStatusChange(status: string) {
    if (!user) return;
    const updated = await updateTask(t.taskId, { status: status as Task['status'] }, user.email);
    onTaskUpdated(updated);
  }

  async function handleAssignSelf() {
    if (!user) return;
    const updated = await updateTask(
      t.taskId,
      { assigneeEmail: user.email, assigneeName: user.name },
      user.email,
    );
    onTaskUpdated(updated);
  }

  async function handleVendorToggle() {
    if (!user) return;
    const next = t.vendorVisible === 'yes' ? 'no' : 'yes';
    const updated = await updateTask(t.taskId, { vendorVisible: next }, user.email);
    onTaskUpdated(updated);
  }

  async function handleDueDateChange(iso: string) {
    if (!user) return;
    const updated = await updateTask(t.taskId, { dueDate: iso }, user.email);
    onTaskUpdated(updated);
  }

  async function handleSaveNotes() {
    if (!user) return;
    setSavingNotes(true);
    try {
      const updated = await updateTask(t.taskId, { internalNotes: notesVal } as Partial<Task>, user.email);
      onTaskUpdated(updated);
      setEditNotes(false);
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList?.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const f = await uploadTaskFile(t.taskId, t.eventCode, file, user.email);
        onFileAdded(f);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!user) return;
    await deleteTaskFile(fileId, user.email);
    onFileRemoved(fileId);
  }

  return (
    <div className="task-panel">
      {/* ── Header ── */}
      <header className="task-panel__header">
        <div
          className="task-panel__cat-badge"
          style={{ background: cat.bg, color: cat.color }}
        >
          <span aria-hidden="true">{cat.emoji}</span>
          {cat.label}
        </div>
        <span className={`task-panel__status-badge ${sc.cls}`}>{sc.label}</span>
      </header>

      <h2 className="task-panel__title">{t.title}</h2>

      {/* ── Controls row ── */}
      <div className="task-panel__controls">
        <label className="task-panel__control-label">
          Status
          <select
            value={t.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={sc.cls}
            disabled={!user}
          >
            {TASK_STATUSES.map((s) => (
              <option
                key={s.value}
                value={s.value}
                disabled={s.value === 'done' && !canComplete}
              >
                {s.value === 'done' && !canComplete ? `${s.label} (assigned only)` : s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="task-panel__control-label">
          Due date
          <DateInput
            value={t.dueDate || ''}
            onChange={(iso) => {
              if (!user) return;
              void handleDueDateChange(iso);
            }}
            className={dueOverdue ? 'overdue' : ''}
            disabled={!user}
          />
        </label>
      </div>

      {/* Assignment / completion notice */}
      {user && !canComplete && t.status !== 'done' && (
        <p className="task-panel__lock-notice">
          🔒 Only <strong>{t.assigneeName || 'the assignee'}</strong> can mark this task complete
        </p>
      )}

      {t.status === 'done' && t.completedBy && (
        <p className="task-panel__completion-record">
          ✓ Completed by <strong>{t.completedBy}</strong>
          {t.completedAt && (
            <> · {new Date(t.completedAt).toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}</>
          )}
        </p>
      )}

      {t.dueDate && (
        <p className={`task-panel__due-hint ${dueOverdue ? 'task-panel__due-hint--overdue' : ''}`}>
          {dueOverdue ? '⚠ ' : ''}
          {daysLabel(t.dueDate)}
        </p>
      )}

      {/* ── Assignee ── */}
      <div className="task-panel__assignee-row">
        {t.assigneeName ? (
          <span className="task-panel__assignee">
            <span className="task-panel__assignee-avatar">{t.assigneeName.charAt(0).toUpperCase()}</span>
            {t.assigneeName}
          </span>
        ) : (
          user && (
            <button type="button" className="task-panel__assign" onClick={handleAssignSelf}>
              + Assign to me
            </button>
          )
        )}
        {/* Vendor toggle */}
        {user && (
          <button
            type="button"
            className={`task-panel__vendor-toggle ${t.vendorVisible === 'yes' ? 'active' : ''}`}
            onClick={handleVendorToggle}
            title={
              t.vendorVisible === 'yes'
                ? 'Visible on vendor portal — click to hide'
                : 'Hidden from vendors — click to share'
            }
          >
            {t.vendorVisible === 'yes' ? '🔗 Shared with vendor' : '🔒 Internal only'}
          </button>
        )}
      </div>

      {/* ── Per diem form generator shortcut ── */}
      {t.templateId === 'tpl-per-diem-form' && (
        <section className="task-panel__section task-panel__perdiem-cta">
          <a
            href={buildPerDiemUrl(t.instructions)}
            target="_blank"
            rel="noreferrer"
            className="task-panel__perdiem-btn"
          >
            📋 Open Per Diem Form Generator
          </a>
          <span className="task-panel__perdiem-hint">
            Enter amounts → generate → print one form per traveler
          </span>
        </section>
      )}

      {/* ── Transfer list generator shortcut ── */}
      {t.templateId === 'tpl-transfer' && (
        <section className="task-panel__section task-panel__transfer-cta">
          {tlMeta ? (
            <>
              <div className="task-panel__tl-saved">
                <span className="task-panel__tl-saved__icon">💾</span>
                <div className="task-panel__tl-saved__info">
                  <strong>{tlMeta.travelerCount} traveler{tlMeta.travelerCount !== 1 ? 's' : ''} saved</strong>
                  <span>
                    {tlMeta.savedBy ? `by ${tlMeta.savedBy} · ` : ''}
                    {new Date(tlMeta.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="task-panel__tl-btns">
                <a
                  href={`/transfer-list?code=${encodeURIComponent(t.eventCode)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="task-panel__transfer-btn task-panel__transfer-btn--update"
                >
                  ✏️ Update Transfer List
                </a>
                <a
                  href={`/transfer-list?code=${encodeURIComponent(t.eventCode)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="task-panel__transfer-btn task-panel__transfer-btn--secondary"
                >
                  📥 Export
                </a>
              </div>
            </>
          ) : (
            <>
              <a
                href={buildTransferUrl(t.instructions)}
                target="_blank"
                rel="noreferrer"
                className="task-panel__transfer-btn"
              >
                🚌 Open Transfer List Generator
              </a>
              <span className="task-panel__transfer-hint">
                Add travelers → save → export styled .xlsx
              </span>
            </>
          )}
        </section>
      )}

      {/* ── Instructions ── */}
      {t.instructions && (
        <section className="task-panel__section task-panel__instructions">
          <h3>Operational instructions</h3>
          <div className="task-panel__instructions-body">
            {t.instructions.split('\n').map((line, i) => (
              <p key={i}>{renderInstructionLine(line)}</p>
            ))}
          </div>
        </section>
      )}

      {/* ── Internal notes (admin only, never shown to vendors) ── */}
      {isAdmin && (
        <section className="task-panel__section task-panel__notes">
          <h3>
            Internal notes
            <span className="task-panel__notes-label">Admin only · never visible to vendors</span>
          </h3>
          {editNotes ? (
            <>
              <textarea
                rows={3}
                value={notesVal}
                onChange={(e) => setNotesVal(e.target.value)}
                placeholder="PSA contact, budget cap, escalation notes…"
                autoFocus
              />
              <div className="task-panel__notes-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditNotes(false)} disabled={savingNotes}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="task-panel__notes-view"
              onClick={() => { setNotesVal(t.internalNotes || ''); setEditNotes(true); }}
            >
              {t.internalNotes || 'Add internal notes…'}
            </button>
          )}
        </section>
      )}

      {/* ── Files ── */}
      <section className="task-panel__section">
        <h3>
          Operational files
          <span className="task-panel__file-count">{taskFiles.length}</span>
        </h3>
        <p className="task-panel__hint">
          Contracts, SOW extracts, quotes, floor plans, photos — stored per task.
        </p>
        <TaskFileUpload onFilesSelected={handleUpload} disabled={uploading || !user} />
        {uploading && <p className="task-panel__uploading">Uploading…</p>}
        <ul className="task-panel__files">
          {taskFiles.map((f) => (
            <li key={f.fileId}>
              <span className="task-panel__file-icon" aria-hidden="true">
                {f.mimeType?.includes('pdf') ? '📄' : f.mimeType?.includes('image') ? '🖼' : '📎'}
              </span>
              <a href={f.driveUrl} target="_blank" rel="noreferrer">
                {f.fileName}
              </a>
              <span className="task-panel__file-size">{formatSize(f.sizeBytes)}</span>
              {user && (
                <button
                  type="button"
                  className="task-panel__file-del"
                  onClick={() => handleDeleteFile(f.fileId)}
                  aria-label={`Remove ${f.fileName}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {taskFiles.length === 0 && (
            <li className="task-panel__no-files">No files attached yet</li>
          )}
        </ul>
      </section>

      {/* ── Discussion ── */}
      <section className="task-panel__section">
        <h3>Discussion</h3>
        <CommentThread
          comments={taskComments}
          eventCode={t.eventCode}
          taskId={t.taskId}
          onAdded={onCommentAdded}
        />
      </section>
    </div>
  );
}
