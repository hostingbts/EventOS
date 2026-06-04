import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchVendorWorkspace } from '../api/client';
import type { VendorWorkspaceData } from '../types';
import './VendorPortalPage.css';

export function VendorPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<VendorWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No vendor token in URL');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setExpandedTask(null);
    fetchVendorWorkspace(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Invalid link'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="vendor-portal vendor-portal--centered">Loading…</div>;
  if (error || !data) {
    return (
      <div className="vendor-portal vendor-portal--centered vendor-portal--error">
        <h1>Link unavailable</h1>
        <p>{error || 'This vendor link is invalid or has expired.'}</p>
        <p className="vendor-portal__hint">
          Each event has its own unique vendor link. Ask the project owner to share the link for
          your specific project.
        </p>
      </div>
    );
  }

  const { event, tasks, files, vendorCategory, vendorName, permission } = data;
  const scopeLabel = vendorCategory ? `${vendorCategory} portal` : 'Vendor portal';
  const scopeNote = vendorCategory
    ? `Read-only access to ${vendorCategory} tasks for ${event.code} only.`
    : `Read-only access for ${event.code} only. You will only see tasks and files related to this specific project.`;

  return (
    <div className="vendor-portal" data-event={event.code} data-scope={vendorCategory || 'full'}>
      <header className="vendor-portal__header">
        <span className="vendor-portal__badge">
          {scopeLabel} · {event.code}
        </span>
        {vendorName && <p className="vendor-portal__greeting">Welcome, {vendorName}</p>}
        <h1>
          {event.code}
          {event.location ? ` — ${event.location}` : ''}
        </h1>
        <p>
          {event.dates}
          {event.venue ? ` · ${event.venue}` : ''}
          {event.monthGroup ? ` · ${event.monthGroup}` : ''}
        </p>
        <p className="vendor-portal__note">
          {scopeNote}
          {permission === 'collaborate' && ' You can upload files and mark tasks complete.'}
        </p>
      </header>

      <main>
        <h2>
          Your tasks
          <span className="vendor-portal__count">
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </span>
        </h2>
        {tasks.length === 0 ? (
          <p className="vendor-portal__empty">
            {vendorCategory
              ? `No ${vendorCategory} tasks have been assigned yet.`
              : 'No tasks shared yet.'}
          </p>
        ) : (
          <ul className="vendor-portal__tasks">
            {tasks.map((task) => {
              const taskFiles = files.filter((f) => f.taskId === task.taskId);
              const open = expandedTask === task.taskId;
              return (
                <li key={task.taskId} className={open ? 'open' : ''}>
                  <button type="button" className="vendor-portal__task-btn" onClick={() => setExpandedTask(open ? null : task.taskId)}>
                    <span className="vendor-portal__task-cat">{task.category}</span>
                    <strong>{task.title}</strong>
                    <span className={`vendor-portal__status vendor-portal__status--${task.status}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </button>
                  {open && (
                    <div className="vendor-portal__task-body">
                      {task.instructions && (
                        <div className="vendor-portal__instructions">
                          <h3>Instructions</h3>
                          <p>{task.instructions}</p>
                        </div>
                      )}
                      {taskFiles.length > 0 && (
                        <div>
                          <h3>Documents</h3>
                          <ul>
                            {taskFiles.map((f) => (
                              <li key={f.fileId}>
                                <a href={f.driveUrl} target="_blank" rel="noreferrer">
                                  {f.fileName}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
