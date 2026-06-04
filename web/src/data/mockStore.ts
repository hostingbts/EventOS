import type {
  ActivityItem,
  Comment,
  Event,
  Task,
  TaskFile,
  VendorLink,
} from '../types';

const STORAGE_KEY = 'event-ops-mock-state-v2';

export interface MockState {
  /** Events created by the user via "New project". Seeded events live in mockEvents.ts. */
  extraEvents: Event[];
  /** Tasks grouped by event code. */
  tasksByEvent: Record<string, Task[]>;
  /** Comments grouped by event code. */
  commentsByEvent: Record<string, Comment[]>;
  /** Files grouped by task ID. */
  filesByTask: Record<string, TaskFile[]>;
  /** Activity log (most recent first). */
  activity: ActivityItem[];
  /** Vendor links keyed by event code. One active link per event. (Legacy) */
  vendorLinksByEvent: Record<string, VendorLink>;
  /** All vendor links (flat list). Replaces vendorLinksByEvent. */
  vendorLinks: VendorLink[];
}

const initialState: MockState = {
  extraEvents: [],
  tasksByEvent: {},
  commentsByEvent: {},
  filesByTask: {},
  activity: [],
  vendorLinksByEvent: {},
  vendorLinks: [],
};

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function load(): MockState {
  if (!hasStorage()) return { ...initialState };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...initialState };
    const parsed = JSON.parse(raw) as Partial<MockState>;
    const legacy = parsed.vendorLinksByEvent ?? {};
    const flat = parsed.vendorLinks ?? [];
    // One-time migration: pull legacy single-link-per-event into the flat list.
    const migrated = [...flat];
    Object.values(legacy).forEach((link) => {
      if (link && !migrated.some((l) => l.linkId === link.linkId)) {
        migrated.push(link);
      }
    });
    return {
      extraEvents: parsed.extraEvents ?? [],
      tasksByEvent: parsed.tasksByEvent ?? {},
      commentsByEvent: parsed.commentsByEvent ?? {},
      filesByTask: parsed.filesByTask ?? {},
      activity: parsed.activity ?? [],
      vendorLinksByEvent: {},
      vendorLinks: migrated,
    };
  } catch {
    return { ...initialState };
  }
}

const state: MockState = load();

function persist() {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/serialization errors
  }
}

export function getMockState(): MockState {
  return state;
}

export function getTasksFor(eventCode: string): Task[] {
  return state.tasksByEvent[eventCode] || [];
}

export function setTasksFor(eventCode: string, tasks: Task[]): void {
  state.tasksByEvent[eventCode] = tasks;
  persist();
}

export function appendTask(task: Task): void {
  if (!state.tasksByEvent[task.eventCode]) state.tasksByEvent[task.eventCode] = [];
  state.tasksByEvent[task.eventCode].push(task);
  persist();
}

export function updateTaskById(
  taskId: string,
  patch: Partial<Task>,
): Task | null {
  for (const code of Object.keys(state.tasksByEvent)) {
    const idx = state.tasksByEvent[code].findIndex((t) => t.taskId === taskId);
    if (idx >= 0) {
      state.tasksByEvent[code][idx] = {
        ...state.tasksByEvent[code][idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      persist();
      return state.tasksByEvent[code][idx];
    }
  }
  return null;
}

export function getCommentsFor(eventCode: string): Comment[] {
  return state.commentsByEvent[eventCode] || [];
}

export function appendComment(comment: Comment): void {
  if (!state.commentsByEvent[comment.eventCode]) state.commentsByEvent[comment.eventCode] = [];
  state.commentsByEvent[comment.eventCode].push(comment);
  persist();
}

export function getFilesByTask(taskId: string): TaskFile[] {
  return state.filesByTask[taskId] || [];
}

export function getFilesForEvent(eventCode: string): TaskFile[] {
  const out: TaskFile[] = [];
  Object.values(state.filesByTask).forEach((arr) => {
    arr.forEach((f) => {
      if (f.eventCode === eventCode) out.push(f);
    });
  });
  return out;
}

export function appendFile(file: TaskFile): void {
  if (!state.filesByTask[file.taskId]) state.filesByTask[file.taskId] = [];
  state.filesByTask[file.taskId].push(file);
  persist();
}

export function removeFile(fileId: string): void {
  for (const taskId of Object.keys(state.filesByTask)) {
    state.filesByTask[taskId] = state.filesByTask[taskId].filter((f) => f.fileId !== fileId);
  }
  persist();
}

export function pushActivity(item: ActivityItem): void {
  state.activity.unshift(item);
  if (state.activity.length > 500) state.activity.length = 500;
  persist();
}

export function getActivityFor(eventCode: string | null): ActivityItem[] {
  if (!eventCode) return [...state.activity];
  return state.activity.filter((a) => a.eventCode === eventCode);
}

/**
 * Returns ALL active vendor links for an event (full-event + per-category).
 */
export function getVendorLinksForEvent(eventCode: string): VendorLink[] {
  return state.vendorLinks.filter(
    (l) => l.eventCode === eventCode && l.active !== 'no',
  );
}

/**
 * Returns the first active "full event" link for an event (no category scope).
 * Used to render the legacy single-link entry-point.
 */
export function getVendorLinkByEvent(eventCode: string): VendorLink | null {
  return (
    state.vendorLinks.find(
      (l) =>
        l.eventCode === eventCode &&
        l.active !== 'no' &&
        !l.vendorCategory,
    ) || null
  );
}

/** Strict token → link lookup. Never falls back to a different event. */
export function getVendorLinkByToken(token: string): VendorLink | null {
  if (!token) return null;
  return state.vendorLinks.find((l) => l.token === token && l.active !== 'no') || null;
}

export function setVendorLink(link: VendorLink): void {
  const idx = state.vendorLinks.findIndex((l) => l.linkId === link.linkId);
  if (idx >= 0) state.vendorLinks[idx] = link;
  else state.vendorLinks.push(link);
  persist();
}

export function deactivateVendorLink(linkId: string): void {
  const idx = state.vendorLinks.findIndex((l) => l.linkId === linkId);
  if (idx >= 0) {
    state.vendorLinks[idx] = { ...state.vendorLinks[idx], active: 'no' };
    persist();
  }
}

export function appendExtraEvent(event: Event): void {
  state.extraEvents.push(event);
  persist();
}

export function getExtraEvents(): Event[] {
  return [...state.extraEvents];
}

export function updateExtraEvent(rowId: string, patch: Partial<Event>): Event | null {
  const idx = state.extraEvents.findIndex((e) => e.rowId === rowId);
  if (idx < 0) return null;
  state.extraEvents[idx] = { ...state.extraEvents[idx], ...patch };
  persist();
  return state.extraEvents[idx];
}

export function resetMockStore(): void {
  state.extraEvents = [];
  state.tasksByEvent = {};
  state.commentsByEvent = {};
  state.filesByTask = {};
  state.activity = [];
  state.vendorLinksByEvent = {};
  state.vendorLinks = [];
  persist();
}

/**
 * Generate a sufficiently unique token. Uses crypto.randomUUID when available,
 * falling back to a timestamp + random hex combo so two events can never share
 * the same token.
 */
export function generateVendorToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return 'v-' + crypto.randomUUID().replace(/-/g, '');
  }
  return (
    'v-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 12)
  );
}
