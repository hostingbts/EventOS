import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  createTemplate,
  deleteTemplate,
  fetchTemplatesWithFiles,
  uploadTemplateFile,
  updateTemplate,
} from '../api/client';
import { useUser } from '../context/UserContext';
import type { TaskTemplate, TaskTemplateWithFiles } from '../types';
import { KNOWN_VARIABLES } from '../utils/templateVars';
import { OPS_CATEGORIES } from '../utils/categories';
import './TaskTemplatesPage.css';

export function TaskTemplatesPage() {
  const { user, isAdmin, isReady } = useUser();
  const [templates, setTemplates] = useState<TaskTemplateWithFiles[]>([]);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await fetchTemplatesWithFiles());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!isReady) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  async function handleSave() {
    if (!editing || !user) return;
    if (editing.templateId.startsWith('tpl-new')) {
      await createTemplate({ ...editing, createdBy: user.email, actorEmail: user.email });
    } else {
      await updateTemplate(editing.templateId, editing, user.email);
    }
    setEditing(null);
    load();
  }

  async function handleDelete(templateId: string) {
    if (!user || !confirm('Deactivate this template?')) return;
    await deleteTemplate(templateId, user.email);
    load();
  }

  async function handleFileUpload(templateId: string, files: FileList | null) {
    if (!files?.length || !user) return;
    for (const file of Array.from(files)) {
      await uploadTemplateFile(templateId, file, user.email);
    }
    load();
  }

  return (
    <div className="templates-page">
      <header>
        <div>
          <h1>Operational task templates</h1>
          <p>Admin only · Reusable LEM task templates applied when creating a new event — AV, Interpretation, Venue, Transportation, and more.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            setEditing({
              templateId: 'tpl-new-' + Date.now(),
              title: '',
              category: 'General',
              instructions: '',
              defaultAssigneeEmail: '',
              defaultAssigneeName: '',
              sortOrder: 99,
              active: 'yes',
              createdAt: '',
              updatedAt: '',
              createdBy: user?.email || '',
            })
          }
        >
          New template
        </button>
      </header>

      {loading && <p className="templates-page__msg">Loading…</p>}

      <div className="templates-page__grid">
        {templates.map(({ template, files }) => (
          <article key={template.templateId} className="template-card">
            <div className="template-card__head">
              <span
                className="template-card__cat"
                style={{
                  background: OPS_CATEGORIES.find((c) => c.id === template.category)?.bg ?? '#f1f5f9',
                  color: OPS_CATEGORIES.find((c) => c.id === template.category)?.color ?? '#475569',
                }}
              >
                {OPS_CATEGORIES.find((c) => c.id === template.category)?.emoji ?? '📌'}{' '}
                {template.category}
              </span>
              <h2>{template.title}</h2>
            </div>
            <p className="template-card__instructions">{template.instructions || 'No instructions'}</p>
            {template.defaultAssigneeName && (
              <p className="template-card__meta">Default: {template.defaultAssigneeName}</p>
            )}
            <ul className="template-card__files">
              {files.map((f) => (
                <li key={f.fileId}>
                  <a href={f.driveUrl} target="_blank" rel="noreferrer">
                    {f.fileName}
                  </a>
                </li>
              ))}
            </ul>
            <label className="template-card__upload">
              Add reference file
              <input
                type="file"
                hidden
                multiple
                onChange={(e) => handleFileUpload(template.templateId, e.target.files)}
              />
            </label>
            <div className="template-card__actions">
              <button type="button" onClick={() => setEditing({ ...template })}>
                Edit
              </button>
              <button type="button" className="danger" onClick={() => handleDelete(template.templateId)}>
                Deactivate
              </button>
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)} role="presentation">
          <div className="modal-card template-editor" onClick={(e) => e.stopPropagation()}>
            <h2>{editing.templateId.startsWith('tpl-new') ? 'New template' : 'Edit template'}</h2>

            <details className="template-editor__vars">
              <summary>Available variables · click to insert</summary>
              <p>
                Use these placeholders inside the title or instructions. They will be replaced with
                the project's data when the template is applied to an event.
              </p>
              <div className="template-editor__var-grid">
                {KNOWN_VARIABLES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    className="template-editor__var"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        instructions: editing.instructions + ` {{${v.name}}}`,
                      })
                    }
                    title={`${v.description} (e.g. ${v.example})`}
                  >
                    <code>{`{{${v.name}}}`}</code>
                    <small>{v.description}</small>
                  </button>
                ))}
              </div>
            </details>

            <label>
              Title
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="e.g. AV setup for {{event_name}}"
              />
            </label>
            <label>
              Category
              <input
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                placeholder="AV / Catering / Venue / Logistics / Travel / Legal / Finance / Staffing"
                list="template-categories"
              />
              <datalist id="template-categories">
                {OPS_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} label={c.label} />
                ))}
              </datalist>
            </label>
            <label>
              Instructions
              <textarea
                rows={5}
                value={editing.instructions}
                onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
                placeholder="Confirm {{vendor_category}} requirements for {{event_code}} in {{city}}"
              />
            </label>
            <div className="template-editor__row">
              <label>
                Default assignee name
                <input
                  value={editing.defaultAssigneeName}
                  onChange={(e) =>
                    setEditing({ ...editing, defaultAssigneeName: e.target.value })
                  }
                />
              </label>
              <label>
                Default assignee email
                <input
                  type="email"
                  value={editing.defaultAssigneeEmail}
                  onChange={(e) =>
                    setEditing({ ...editing, defaultAssigneeEmail: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Default due-date offset (days from event start)
              <input
                type="number"
                value={editing.dueOffsetDays ?? ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    dueOffsetDays: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                placeholder="e.g. -14 (2 weeks before)"
              />
              <small className="template-editor__hint">
                Negative = before the event. Leave empty for no default due date.
              </small>
            </label>
            <div className="template-editor__footer">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
