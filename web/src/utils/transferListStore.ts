/**
 * Persists transfer list state (setup + travelers) per event in localStorage.
 *
 * Key format: `tl-save-{EVENTCODE}`
 */
import type { TravelerEntry, TransferSetup } from '../pages/TransferListPage';

export interface SavedTransferList {
  setup:        TransferSetup;
  travelers:    TravelerEntry[];
  savedAt:      string;   // ISO timestamp
  savedBy:      string;   // display name
  savedByEmail: string;
  driveUrl?:    string;   // Google Drive share link after save
  driveFileId?: string;   // Stable Drive file ID — link stays the same on re-save
}

function key(eventCode: string): string {
  return `tl-save-${eventCode.trim().toUpperCase()}`;
}

export function saveTransferList(
  eventCode: string,
  data: Omit<SavedTransferList, 'savedAt'> & { savedAt?: string },
): void {
  if (!eventCode.trim()) return;
  const record: SavedTransferList = { ...data, savedAt: data.savedAt ?? new Date().toISOString() };
  localStorage.setItem(key(eventCode), JSON.stringify(record));
}

export function loadTransferList(eventCode: string): SavedTransferList | null {
  if (!eventCode.trim()) return null;
  try {
    const raw = localStorage.getItem(key(eventCode));
    return raw ? (JSON.parse(raw) as SavedTransferList) : null;
  } catch {
    return null;
  }
}

export function deleteTransferList(eventCode: string): void {
  localStorage.removeItem(key(eventCode));
}

/** Returns lightweight metadata without loading the full traveler array. */
export function getTransferListMeta(
  eventCode: string,
): { savedAt: string; travelerCount: number; savedBy: string } | null {
  const data = loadTransferList(eventCode);
  if (!data) return null;
  return {
    savedAt:       data.savedAt,
    travelerCount: data.travelers.length,
    savedBy:       data.savedBy,
  };
}
