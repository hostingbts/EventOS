import { useEffect, useState } from 'react';
import { applyTemplates, fetchTemplatesWithFiles } from '../../api/client';
import type { TaskTemplateWithFiles } from '../../types';
import './ApplyTemplatesModal.css';

interface Props {
  eventCode: string;
  eventRowId: string;
  actorEmail: string;
  onApplied: () => void;
  onClose: () => void;
}

export function ApplyTemplatesModal({ eventCode, eventRowId, actorEmail, onApplied, onClose }: Props) {
  const [templates, setTemplates] = useState<TaskTemplateWithFiles[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplatesWithFiles()
      .then((t) => {
        setTemplates(t);
        setSelected(new Set(t.map((x) => x.template.templateId)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApply() {
    if (selected.size === 0) return;
    setApplying(true);
    setError(null);
    try {
      await applyTemplates(eventCode, eventRowId, Array.from(selected), actorEmail);
      onApplied();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply templates');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card apply-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <header>
          <h2>Add tasks from templates</h2>
          <p>Choose reusable tasks to create for this event. Files attached to templates are copied to each task.</p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {loading && <p className="apply-modal__msg">Loading templates…</p>}
        {error && <p className="apply-modal__err">{error}</p>}

        {!loading && (
          <ul className="apply-modal__list">
            {templates.map(({ template, files }) => (
              <li key={template.templateId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(template.templateId)}
                    onChange={() => toggle(template.templateId)}
                  />
                  <div>
                    <strong>{template.title}</strong>
                    <span className="apply-modal__cat">{template.category}</span>
                    {template.instructions && (
                      <p className="apply-modal__instructions">{template.instructions}</p>
                    )}
                    {files.length > 0 && (
                      <span className="apply-modal__files">{files.length} attached file(s)</span>
                    )}
                    {template.defaultAssigneeName && (
                      <span className="apply-modal__assign">
                        Default assignee: {template.defaultAssigneeName}
                      </span>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}

        <footer>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={applying || selected.size === 0}
            onClick={handleApply}
          >
            {applying ? 'Creating tasks…' : `Add ${selected.size} task(s)`}
          </button>
        </footer>
      </div>
    </div>
  );
}
