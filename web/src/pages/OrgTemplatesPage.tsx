import { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import {
  addOrgTemplate,
  deleteOrgTemplate,
  getOrgTemplates,
  uploadToOrgTemplate,
  type OrgTemplateFile,
} from '../utils/orgTemplatesStore';
import './OrgTemplatesPage.css';

const CATEGORIES = ['Print Materials', 'Social Media', 'Forms', 'Branding', 'Other'];

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word',
  xlsx: 'Excel',
  xls: 'Excel',
  other: 'File',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  docx: '#3b82f6',
  doc: '#3b82f6',
  xlsx: '#22c55e',
  xls: '#22c55e',
  other: '#94a3b8',
};

function FileTypeBadge({ type }: { type: string }) {
  return (
    <span
      className="otf-badge"
      style={{ background: FILE_TYPE_COLORS[type] ?? FILE_TYPE_COLORS.other }}
    >
      {FILE_TYPE_LABELS[type] ?? type.toUpperCase()}
    </span>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, string> = {
    'Print Materials': '🖨️',
    'Social Media': '📱',
    'Forms': '📋',
    'Branding': '🎨',
    'Other': '📎',
  };
  return <span>{icons[category] ?? '📄'}</span>;
}

interface PreviewModalProps {
  file: OrgTemplateFile;
  onClose: () => void;
}

function PreviewModal({ file, onClose }: PreviewModalProps) {
  function handleDownload() {
    if (!file.dataUrl) return;
    const a = document.createElement('a');
    a.href = file.dataUrl;
    a.download = file.name + (file.fileType !== 'other' ? '.' + file.fileType : '');
    a.click();
  }

  return (
    <div className="otf-modal-overlay" onClick={onClose} role="presentation">
      <div className="otf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="otf-modal__header">
          <div className="otf-modal__title">
            <FileTypeBadge type={file.fileType} />
            <h2>{file.name}</h2>
          </div>
          <div className="otf-modal__actions">
            {file.dataUrl && (
              <button type="button" className="otf-btn otf-btn--primary" onClick={handleDownload}>
                ↓ Download
              </button>
            )}
            <button type="button" className="otf-modal__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="otf-modal__body">
          {!file.dataUrl ? (
            <div className="otf-modal__no-preview">
              <span className="otf-modal__file-icon">📄</span>
              <p>File not uploaded yet.</p>
              <p className="otf-modal__hint">An admin can upload the file to enable preview and download.</p>
            </div>
          ) : file.fileType === 'pdf' ? (
            <iframe
              src={file.dataUrl}
              title={file.name}
              className="otf-modal__pdf-frame"
            />
          ) : (
            <div className="otf-modal__no-preview">
              <span className="otf-modal__file-icon">
                {file.fileType === 'docx' || file.fileType === 'doc' ? '📝' :
                 file.fileType === 'xlsx' || file.fileType === 'xls' ? '📊' : '📄'}
              </span>
              <p>Preview not available for {FILE_TYPE_LABELS[file.fileType] ?? file.fileType} files.</p>
              <button type="button" className="otf-btn otf-btn--primary" onClick={handleDownload}>
                ↓ Download to view
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrgTemplatesPage() {
  const { user, isAdmin } = useUser();
  const [files, setFiles] = useState<OrgTemplateFile[]>([]);
  const [preview, setPreview] = useState<OrgTemplateFile | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const addFileInput = useRef<HTMLInputElement>(null);

  function refresh() {
    setFiles(getOrgTemplates());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddFile(fileList: FileList | null) {
    if (!fileList?.length || !user) return;
    setUploading('new');
    try {
      for (const f of Array.from(fileList)) {
        await addOrgTemplate(f, newCategory, user.name);
      }
      refresh();
      setAddModal(false);
    } finally {
      setUploading(null);
    }
  }

  async function handleUploadToExisting(id: string, fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(id);
    try {
      await uploadToOrgTemplate(id, fileList[0]);
      refresh();
      if (preview?.id === id) {
        setPreview(getOrgTemplates().find((f) => f.id === id) ?? null);
      }
    } finally {
      setUploading(null);
    }
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the template library?`)) return;
    deleteOrgTemplate(id);
    refresh();
    if (preview?.id === id) setPreview(null);
  }

  const grouped = CATEGORIES.reduce<Record<string, OrgTemplateFile[]>>(
    (acc, cat) => {
      acc[cat] = files.filter((f) => f.category === cat);
      return acc;
    },
    {},
  );
  const otherFiles = files.filter((f) => !CATEGORIES.includes(f.category));
  if (otherFiles.length) {
    grouped['Other'] = [...(grouped['Other'] ?? []), ...otherFiles];
  }

  return (
    <div className="otf-page">
      <header className="otf-page__header">
        <div>
          <h1>Templates</h1>
          <p>Branded and operational template files for the team — print materials, social media assets, and forms.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="otf-btn otf-btn--primary"
            onClick={() => setAddModal(true)}
          >
            + Add file
          </button>
        )}
      </header>

      {CATEGORIES.map((cat) => {
        const catFiles = grouped[cat] ?? [];
        if (!catFiles.length) return null;
        return (
          <section key={cat} className="otf-section">
            <h2 className="otf-section__title">
              <CategoryIcon category={cat} /> {cat}
              <span className="otf-section__count">{catFiles.length}</span>
            </h2>
            <div className="otf-grid">
              {catFiles.map((f) => (
                <article key={f.id} className={`otf-card${f.dataUrl ? '' : ' otf-card--pending'}`}>
                  <div className="otf-card__top">
                    <div className="otf-card__thumb" onClick={() => setPreview(f)}>
                      {f.dataUrl && f.fileType === 'pdf' ? (
                        <iframe
                          src={f.dataUrl + '#toolbar=0&navpanes=0&scrollbar=0'}
                          title={f.name}
                          className="otf-card__thumb-frame"
                          tabIndex={-1}
                        />
                      ) : (
                        <span className="otf-card__thumb-icon">
                          {f.fileType === 'pdf' ? '📄'
                            : f.fileType === 'docx' || f.fileType === 'doc' ? '📝'
                            : f.fileType === 'xlsx' || f.fileType === 'xls' ? '📊'
                            : '📎'}
                        </span>
                      )}
                      <div className="otf-card__thumb-overlay">
                        <span>
                          {f.dataUrl
                            ? '👁 Preview'
                            : isAdmin
                              ? '📤 Upload'
                              : '📄 View'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="otf-card__body">
                    <FileTypeBadge type={f.fileType} />
                    <h3 className="otf-card__name" title={f.name}>{f.name}</h3>
                    {!f.dataUrl && isAdmin && (
                      <p className="otf-card__status">File not uploaded yet</p>
                    )}
                    {!f.dataUrl && !isAdmin && (
                      <p className="otf-card__status otf-card__status--muted">Coming soon</p>
                    )}
                    {f.addedAt && (
                      <p className="otf-card__meta">
                        {f.addedBy} · {new Date(f.addedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="otf-card__footer">
                    <button
                      type="button"
                      className="otf-btn otf-btn--sm otf-btn--ghost"
                      onClick={() => setPreview(f)}
                      disabled={uploading === f.id}
                    >
                      {f.dataUrl ? 'Preview' : 'View'}
                    </button>

                    {isAdmin && (
                      <>
                        <label
                          className={`otf-btn otf-btn--sm otf-btn--secondary${uploading === f.id ? ' loading' : ''}`}
                          title="Upload file"
                        >
                          {uploading === f.id ? '…' : f.dataUrl ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            hidden
                            accept=".pdf,.docx,.doc,.xlsx,.xls"
                            onChange={(e) => handleUploadToExisting(f.id, e.target.files)}
                          />
                        </label>
                        <button
                          type="button"
                          className="otf-btn otf-btn--sm otf-btn--danger"
                          onClick={() => handleDelete(f.id, f.name)}
                          title="Remove from library"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {files.length === 0 && (
        <div className="otf-empty">
          <p>No template files yet.</p>
          {isAdmin && <p>Click <strong>+ Add file</strong> to upload the first one.</p>}
        </div>
      )}

      {/* Preview modal */}
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}

      {/* Add new file modal (admin) */}
      {addModal && isAdmin && (
        <div className="otf-modal-overlay" onClick={() => setAddModal(false)} role="presentation">
          <div className="otf-modal otf-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="otf-modal__header">
              <h2>Add template file</h2>
              <button type="button" className="otf-modal__close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <div className="otf-modal__form">
              <label>
                Category
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div
                className={`otf-dropzone${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleAddFile(e.dataTransfer.files);
                }}
                onClick={() => addFileInput.current?.click()}
              >
                <span>📤</span>
                <p>Drop file here or click to browse</p>
                <small>PDF, Word, or Excel</small>
                <input
                  ref={addFileInput}
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.docx,.doc,.xlsx,.xls"
                  onChange={(e) => handleAddFile(e.target.files)}
                />
              </div>
              {uploading === 'new' && <p className="otf-uploading">Uploading…</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
