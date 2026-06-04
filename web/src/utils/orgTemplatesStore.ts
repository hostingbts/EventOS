const STORAGE_KEY = 'org_template_files_v1';

export interface OrgTemplateFile {
  id: string;
  name: string;
  category: string;
  fileType: string; // 'pdf' | 'docx' | 'xlsx' | 'other'
  /** data URL — set once the file has been uploaded */
  dataUrl?: string;
  sizeBytes?: number;
  addedBy: string;
  addedAt: string;
  /** true for the pre-seeded placeholder entries */
  builtIn?: boolean;
}

const SEED_FILES: OrgTemplateFile[] = [
  { id: 'otf-cert-holder',    name: 'Certificate Holder – CLDP',      category: 'Print Materials', fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-backdrop1',      name: 'Backdrop 11',                     category: 'Print Materials', fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-backdrop2',      name: 'Backdrop 22',                     category: 'Print Materials', fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-bloknot',        name: 'Bloknot (Notebook)',              category: 'Print Materials', fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-pocket-folder',  name: 'CLDP Pocket Folder',             category: 'Print Materials', fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-notebook-design',name: 'Notebook Design',                 category: 'Print Materials', fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-social-qr',      name: 'CLDP Social Media – QR Codes',   category: 'Social Media',    fileType: 'docx', addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-social-pdf',     name: 'CLDP Social Media',               category: 'Social Media',    fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
  { id: 'otf-per-diem',       name: 'Per Diem Distribution Form',      category: 'Forms',           fileType: 'pdf',  addedBy: 'system', addedAt: '', builtIn: true },
];

function load(): OrgTemplateFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as OrgTemplateFile[];
  } catch {
    // ignore
  }
  return SEED_FILES.map((f) => ({ ...f }));
}

function save(files: OrgTemplateFile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function getOrgTemplates(): OrgTemplateFile[] {
  return load();
}

export function addOrgTemplate(
  file: File,
  category: string,
  actorName: string,
): Promise<OrgTemplateFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const files = load();
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'other';
      const fileType =
        ext === 'pdf' ? 'pdf'
        : ext === 'docx' || ext === 'doc' ? 'docx'
        : ext === 'xlsx' || ext === 'xls' ? 'xlsx'
        : 'other';
      const entry: OrgTemplateFile = {
        id: 'otf-' + Date.now(),
        name: file.name.replace(/\.[^.]+$/, ''),
        category,
        fileType,
        dataUrl: reader.result as string,
        sizeBytes: file.size,
        addedBy: actorName,
        addedAt: new Date().toISOString(),
      };
      save([...files, entry]);
      resolve(entry);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function uploadToOrgTemplate(
  id: string,
  file: File,
): Promise<OrgTemplateFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const files = load();
      const idx = files.findIndex((f) => f.id === id);
      if (idx === -1) { reject(new Error('Not found')); return; }
      files[idx] = {
        ...files[idx],
        dataUrl: reader.result as string,
        sizeBytes: file.size,
        fileType: file.name.split('.').pop()?.toLowerCase() ?? files[idx].fileType,
      };
      save(files);
      resolve(files[idx]);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function deleteOrgTemplate(id: string): void {
  const files = load().filter((f) => f.id !== id);
  save(files);
}

export function resetToSeed(): void {
  localStorage.removeItem(STORAGE_KEY);
}
