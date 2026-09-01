import { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import {
  deleteOrgTemplateFile,
  fetchOrgTemplates,
  saveOrgTemplateFile,
  type OrgTemplateFile,
} from '../api/client';
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

/** Embeddable preview URL — Drive's plain share link ("/view") refuses to be
 * framed, but "/preview" is designed for exactly this. Falls back to
 * whatever URL we have (e.g. a data: URL in demo/mock mode). */
function previewSrc(f: OrgTemplateFile): string | undefined {
  if (f.driveFileId) return `https://drive.google.com/file/d/${f.driveFileId}/preview`;
  return f.driveUrl;
}

/** A URL that actually streams the file instead of opening Drive's viewer. */
function downloadHref(f: OrgTemplateFile): string | undefined {
  if (f.driveFileId) return `https://drive.google.com/uc?export=download&id=${f.driveFileId}`;
  return f.driveUrl;
}

/** The normal Drive "view" link — safe to hand to anyone, since these files
 * are already shared org-wide with no login required. */
function shareUrl(f: OrgTemplateFile): string | undefined {
  if (f.driveUrl) return f.driveUrl;
  if (f.driveFileId) return `https://drive.google.com/file/d/${f.driveFileId}/view?usp=sharing`;
  return undefined;
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

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
  const href = downloadHref(file);
  const src = previewSrc(file);
  const link = shareUrl(file);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!link) return;
    await copyToClipboard(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            {link && (
              <button type="button" className="otf-btn otf-btn--secondary" onClick={handleCopy}>
                {copied ? '✓ Copied!' : '🔗 Copy link'}
              </button>
            )}
            {href && (
              <a className="otf-btn otf-btn--primary" href={href} target="_blank" rel="noopener noreferrer">
                ↓ Download
              </a>
            )}
            <button type="button" className="otf-modal__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="otf-modal__body">
          {!src ? (
            <div className="otf-modal__no-preview">
              <span className="otf-modal__file-icon">📄</span>
              <p>File not uploaded yet.</p>
              <p className="otf-modal__hint">An admin can upload the file to enable preview and download.</p>
            </div>
          ) : (
            <iframe src={src} title={file.name} className="otf-modal__pdf-frame" />
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
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const addFileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setFiles(await fetchOrgTemplates());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddFile(fileList: FileList | null) {
    if (!fileList?.length || !user) return;
    setUploading('new');
    setError(null);
    try {
      for (const f of Array.from(fileList)) {
        await saveOrgTemplateFile({ name: f.name.replace(/\.[^.]+$/, ''), category: newCategory, file: f, actorEmail: user.email });
      }
      await refresh();
      setAddModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function handleUploadToExisting(id: string, fileList: FileList | null) {
    if (!fileList?.length || !user) return;
    setUploading(id);
    setError(null);
    try {
      await saveOrgTemplateFile({ id, file: fileList[0], actorEmail: user.email });
      await refresh();
      if (preview?.id === id) {
        setPreview((await fetchOrgTemplates()).find((f) => f.id === id) ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function handleCopyLink(f: OrgTemplateFile) {
    const link = shareUrl(f);
    if (!link) return;
    await copyToClipboard(link);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId((cur) => (cur === f.id ? null : cur)), 2000);
  }

  async function handleDelete(id: string, name: string) {
    if (!user || !confirm(`Remove "${name}" from the template library?`)) return;
    try {
      await deleteOrgTemplateFile(id, user.email);
      await refresh();
      if (preview?.id === id) setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove template');
    }
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

      {error && <p className="otf-error">{error}</p>}

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
              {catFiles.map((f) => {
                const hasFile = Boolean(f.driveUrl);
                return (
                  <article key={f.id} className={`otf-card${hasFile ? '' : ' otf-card--pending'}`}>
                    <div className="otf-card__top">
                      <div className="otf-card__thumb" onClick={() => setPreview(f)}>
                        {hasFile && f.fileType === 'pdf' ? (
                          <iframe
                            src={previewSrc(f)}
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
                            {hasFile
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
                      {!hasFile && isAdmin && (
                        <p className="otf-card__status">File not uploaded yet</p>
                      )}
                      {!hasFile && !isAdmin && (
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
                        className="otf-btn otf-btn--sm otf-btn--icon otf-btn--ghost"
                        onClick={() => setPreview(f)}
                        disabled={uploading === f.id}
                        title={hasFile ? 'Preview' : 'View'}
                        aria-label={hasFile ? 'Preview' : 'View'}
                      >
                        👁
                      </button>

                      {hasFile && (
                        <button
                          type="button"
                          className="otf-btn otf-btn--sm otf-btn--icon otf-btn--secondary"
                          onClick={() => handleCopyLink(f)}
                          title={copiedId === f.id ? 'Copied!' : 'Copy a shareable link to this file'}
                          aria-label="Copy shareable link"
                        >
                          {copiedId === f.id ? '✓' : '🔗'}
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <label
                            className={`otf-btn otf-btn--sm otf-btn--secondary${uploading === f.id ? ' loading' : ''}`}
                            title="Upload file"
                          >
                            {uploading === f.id ? '…' : hasFile ? 'Replace' : 'Upload'}
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
                );
              })}
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
