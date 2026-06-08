// ─── Role & capability definitions ────────────────────────────────────────

export type AppRole = 'admin' | 'project_lead' | 'director';

export const ROLE_LABELS: Record<AppRole, string> = {
  admin:        'Admin',
  project_lead: 'Project Lead',
  director:     'Director',
};

export const ROLE_COLORS: Record<AppRole, { bg: string; color: string }> = {
  admin:        { bg: '#fee2e2', color: '#b91c1c' },
  project_lead: { bg: '#dbeafe', color: '#1d4ed8' },
  director:     { bg: '#ede9fe', color: '#6d28d9' },
};

// ─── Capabilities ─────────────────────────────────────────────────────────

export type AppCapability =
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'tasks.view'
  | 'tasks.manage'
  | 'task_templates'
  | 'team.view'
  | 'templates.view'
  | 'templates.manage'
  | 'designs'
  | 'generators'
  | 'sow_generator'
  | 'admin_panel';

export interface CapabilityMeta {
  key: AppCapability;
  label: string;
  group: string;
  /** Admin always has this — cannot be toggled */
  adminLocked?: boolean;
}

export const CAPABILITY_LIST: CapabilityMeta[] = [
  { key: 'events.view',        label: 'View events & workspaces',    group: 'Events' },
  { key: 'events.create',      label: 'Create new events',           group: 'Events' },
  { key: 'events.edit',        label: 'Edit event details',          group: 'Events' },
  { key: 'tasks.view',         label: 'View tasks',                  group: 'Tasks' },
  { key: 'tasks.manage',       label: 'Create / update tasks',       group: 'Tasks' },
  { key: 'task_templates',     label: 'Task Templates page',         group: 'Tasks' },
  { key: 'team.view',          label: 'View team members',           group: 'Team' },
  { key: 'templates.view',     label: 'View file templates',         group: 'Templates' },
  { key: 'templates.manage',   label: 'Upload / delete templates',   group: 'Templates' },
  { key: 'designs',            label: 'Designs (badges, certs…)',    group: 'Tools' },
  { key: 'generators',         label: 'Generators hub',              group: 'Tools' },
  { key: 'sow_generator',      label: 'SOW Event Generator',         group: 'Tools' },
  { key: 'admin_panel',        label: 'Admin Panel',                 group: 'Admin', adminLocked: true },
];

export type CapMatrix = Record<AppRole, Record<AppCapability, boolean>>;

const DEFAULT_MATRIX: CapMatrix = {
  admin: Object.fromEntries(
    CAPABILITY_LIST.map((c) => [c.key, true]),
  ) as Record<AppCapability, boolean>,

  project_lead: {
    'events.view':       true,
    'events.create':     true,
    'events.edit':       true,
    'tasks.view':        true,
    'tasks.manage':      true,
    'task_templates':    false,
    'team.view':         true,
    'templates.view':    true,
    'templates.manage':  false,
    'designs':           true,
    'generators':        true,
    'sow_generator':     false,
    'admin_panel':       false,
  },

  director: {
    'events.view':       true,
    'events.create':     false,
    'events.edit':       false,
    'tasks.view':        true,
    'tasks.manage':      false,
    'task_templates':    false,
    'team.view':         true,
    'templates.view':    true,
    'templates.manage':  false,
    'designs':           true,
    'generators':        false,
    'sow_generator':     false,
    'admin_panel':       false,
  },
};

// ─── Org members ──────────────────────────────────────────────────────────

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: 'active' | 'invited' | 'inactive';
  createdAt: string;
  invitedBy: string;
}

const MEMBERS_KEY = 'org_members_v1';
const CAPS_KEY    = 'role_capabilities_v1';

const SEED_MEMBERS: OrgMember[] = [
  { id: 'seed-admin', name: 'Admin',       email: 'admin@team.org',    role: 'admin',        status: 'active', createdAt: '2025-01-01', invitedBy: '' },
  { id: 'seed-lead',  name: 'Lead',        email: 'lead@team.org',     role: 'project_lead', status: 'active', createdAt: '2025-01-01', invitedBy: 'admin@team.org' },
  { id: 'seed-dir',   name: 'Director',    email: 'director@team.org', role: 'director',     status: 'active', createdAt: '2025-01-01', invitedBy: 'admin@team.org' },
  { id: 'member-noemi', name: 'Noemi', email: 'translations@connectmice.com', role: 'project_lead', status: 'active', createdAt: '2026-06-05', invitedBy: 'admin@connectmice.com' },
];

// ── Members CRUD ─────────────────────────────────────────────────────────

export function getMembers(): OrgMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    if (raw) return JSON.parse(raw) as OrgMember[];
  } catch { /* ignore */ }
  // First run: seed defaults (mock mode only; real mode seeds via initAuthStore)
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(SEED_MEMBERS));
  return SEED_MEMBERS;
}

export function saveMembers(members: OrgMember[]): void {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function getMemberByEmail(email: string): OrgMember | null {
  return getMembers().find((m) => m.email.toLowerCase() === email.toLowerCase()) ?? null;
}

/**
 * Upserts a member in the local cache and, in real mode, fires a background
 * write to GAS (non-blocking so the UI stays responsive).
 */
export function upsertMember(member: OrgMember, actorEmail?: string): void {
  // Local cache update (synchronous — keeps existing callers unchanged)
  const all = getMembers();
  const idx = all.findIndex((m) => m.id === member.id);
  if (idx >= 0) all[idx] = member;
  else all.push(member);
  saveMembers(all);

  // Background sync to GAS (fire-and-forget)
  import('../api/client').then(({ useMockData, apiMembersUpsert }) => {
    if (!useMockData()) {
      apiMembersUpsert(member, actorEmail ?? '').catch((err) =>
        console.warn('[roleStore] membersUpsert failed:', err),
      );
    }
  });
}

/**
 * Deactivates a member in the local cache and, in real mode, fires a
 * background write to GAS.
 */
export function deactivateMember(id: string, actorEmail?: string): void {
  const all = getMembers().map((m) => m.id === id ? { ...m, status: 'inactive' as const } : m);
  saveMembers(all);

  import('../api/client').then(({ useMockData, apiMembersDeactivate }) => {
    if (!useMockData()) {
      apiMembersDeactivate(id, actorEmail ?? '').catch((err) =>
        console.warn('[roleStore] membersDeactivate failed:', err),
      );
    }
  });
}

// ── Capability matrix CRUD ───────────────────────────────────────────────

export function getCapMatrix(): CapMatrix {
  try {
    const raw = localStorage.getItem(CAPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CapMatrix;
      parsed.admin = DEFAULT_MATRIX.admin;
      return parsed;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_MATRIX };
}

/**
 * Saves the capability matrix to the local cache and, in real mode, fires a
 * background write to GAS.
 */
export function saveCapMatrix(matrix: CapMatrix, actorEmail?: string): void {
  matrix.admin = DEFAULT_MATRIX.admin;
  localStorage.setItem(CAPS_KEY, JSON.stringify(matrix));

  import('../api/client').then(({ useMockData, apiCapsSave }) => {
    if (!useMockData()) {
      apiCapsSave(matrix, actorEmail ?? '').catch((err) =>
        console.warn('[roleStore] capsSave failed:', err),
      );
    }
  });
}

export function can(role: AppRole | null | undefined, cap: AppCapability): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const matrix = getCapMatrix();
  return matrix[role]?.[cap] ?? false;
}

// ── Remote sync helpers (called by initAuthStore on startup) ──────────────

/** Fetches org members from GAS and refreshes the localStorage cache. */
export async function fetchAndCacheMembers(): Promise<void> {
  const { apiMembersList } = await import('../api/client');
  try {
    const members = await apiMembersList();
    if (members.length > 0) saveMembers(members);
  } catch (err) {
    console.warn('[roleStore] Failed to fetch members from server:', err);
  }
}

/** Fetches the capability matrix from GAS and refreshes the localStorage cache. */
export async function fetchAndCacheCapMatrix(): Promise<void> {
  const { apiCapsList } = await import('../api/client');
  try {
    const matrix = await apiCapsList();
    if (matrix) {
      matrix.admin = DEFAULT_MATRIX.admin;
      localStorage.setItem(CAPS_KEY, JSON.stringify(matrix));
    }
  } catch (err) {
    console.warn('[roleStore] Failed to fetch cap matrix from server:', err);
  }
}
