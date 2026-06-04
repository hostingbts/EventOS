const DESIGNS_KEY = 'event_designs_v1';

export type BadgePreset = '90x54' | '85x55' | '105x74' | '105x148' | 'custom';

export const BADGE_PRESETS: Record<BadgePreset, { label: string; w: number; h: number }> = {
  '90x54':   { label: '90 × 54 mm — standard credit-card', w: 90,  h: 54  },
  '85x55':   { label: '85 × 55 mm — standard',             w: 85,  h: 55  },
  '105x74':  { label: '105 × 74 mm — medium lanyard',      w: 105, h: 74  },
  '105x148': { label: '105 × 148 mm — large / A6',         w: 105, h: 148 },
  'custom':  { label: 'Custom size…',                      w: 90,  h: 54  },
};

export type BannerSize = '85x200' | '80x200';

export interface DesignSigner {
  id: string;
  name: string;
  title: string;
}

export interface EventDesignSetup {
  eventCode: string;
  /** Overrideable — pre-filled from event.location / event.dates */
  title: string;
  dateStr: string;
  cityCountry: string;
  /** Ordered array of logo / flag data-URLs (any number) */
  logos: string[];
  primaryColor: string;
  accentColor: string;
  /** Certificate signers */
  signers: DesignSigner[];
  /** Name badge dimensions */
  badgePreset: BadgePreset;
  badgeWidthMm: number;
  badgeHeightMm: number;
  /** Banner size */
  bannerSize: BannerSize;
  savedAt: string;
  savedBy: string;
}

export interface DesignAttendee {
  id: string;
  name: string;
  title: string;
  organization: string;
}

type DesignStore = Record<string, { setup: EventDesignSetup; attendees: DesignAttendee[] }>;

function load(): DesignStore {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY);
    if (raw) return JSON.parse(raw) as DesignStore;
  } catch { /* ignore */ }
  return {};
}

function save(store: DesignStore): void {
  localStorage.setItem(DESIGNS_KEY, JSON.stringify(store));
}

export function getEventDesign(eventCode: string): EventDesignSetup | null {
  return load()[eventCode]?.setup ?? null;
}

export function getEventAttendees(eventCode: string): DesignAttendee[] {
  return load()[eventCode]?.attendees ?? [];
}

export function saveEventDesign(setup: EventDesignSetup): void {
  const store = load();
  store[setup.eventCode] = { setup, attendees: store[setup.eventCode]?.attendees ?? [] };
  save(store);
}

export function saveEventAttendees(eventCode: string, attendees: DesignAttendee[]): void {
  const store = load();
  const existing = store[eventCode];
  if (!existing) return;
  existing.attendees = attendees;
  save(store);
}

export function getAllEventDesigns(): Array<{ setup: EventDesignSetup; attendeeCount: number }> {
  return Object.values(load()).map(({ setup, attendees }) => ({
    setup,
    attendeeCount: attendees.length,
  }));
}

export function deleteEventDesign(eventCode: string): void {
  const store = load();
  delete store[eventCode];
  save(store);
}

export const BRAND_COLOR = '#203864';

export function makeDefaultSetup(
  eventCode: string,
  title: string,
  dateStr: string,
  cityCountry: string,
  savedBy: string,
): EventDesignSetup {
  return {
    eventCode,
    title,
    dateStr,
    cityCountry,
    logos: [],
    primaryColor: '#203864',
    accentColor: '#203864',
    signers: [],
    badgePreset: '90x54',
    badgeWidthMm: 90,
    badgeHeightMm: 54,
    bannerSize: '85x200',
    savedAt: new Date().toISOString(),
    savedBy,
  };
}
