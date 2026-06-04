/**
 * Parses a PSA/CLDP LEM Statement of Work (SOW) PDF.
 *
 * Supports both SOW formats:
 *   - Older format (J144-style): "Department of Commerce Call Order #: J1144"
 *   - Newer format (J276-style): "Call Order #: J276" with "LEM TASKS:" section
 *
 * The parser uses regex patterns against the full PDF text and returns a
 * structured ParsedSOW object that can be used to pre-fill the event creation form.
 */
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore — Vite resolves this at build time
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SOWPackages {
  fullLEM:        boolean;
  minimalLEM:     boolean;
  venue:          boolean;
  language:       boolean;
  printing:       boolean;
  travelServices: boolean;
  catering:       boolean;
  registration:   boolean;
  photography:    boolean;
  internet:       boolean;
  perDiem:        boolean;
  lodging:        boolean;
  groundTransport:boolean;
  interpretation: boolean;
}

export interface ParsedSOW {
  /** e.g. "J276" */
  eventCode:          string;
  /** e.g. "Eurasia Arbitration Week Astana Jun26" */
  meetingName:        string;
  /** e.g. "Astana, Kazakhstan" */
  location:           string;
  /** e.g. "Astana" — just the city part */
  city:               string;
  /** ISO "YYYY-MM-DD" */
  startDate:          string;
  /** ISO "YYYY-MM-DD" */
  endDate:            string;
  /** Human-readable display string e.g. "June 30 – July 3" */
  dates:              string;
  /** "In-Person" | "Virtual" | "" */
  meetingType:        string;
  /** LEM fluency language e.g. "French" */
  language:           string;
  /** Total participants */
  totalParticipants:  string;
  /** e.g. "Classroom" */
  setupStyle:         string;
  /** Notes assembled from description */
  notes:              string;
  /** Financial fields */
  perDiemRate:        string;
  maxVisaAllowance:   string;
  maxGroundTransport: string;
  /** Which SOW packages were detected as "Yes" */
  packages:           SOWPackages;
  /** Template IDs that should be pre-selected based on packages */
  suggestedTemplateIds: string[];
  /** Raw extracted text (for debugging) */
  rawText:            string;
}

// ─── PDF text extraction ───────────────────────────────────────────────────────

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    parts.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
    );
    parts.push('\n');
  }
  return parts.join('');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Pick first non-empty capture group match from text */
function pick(text: string, ...patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const val = (m[1] ?? m[0]).trim();
      if (val) return val;
    }
  }
  return '';
}

/** Convert MM/DD/YY to YYYY-MM-DD */
function parseMMDDYY(raw: string): string {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (!m) return '';
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm}-${dd}`;
}

/** Convert "MM/DD/YY" dates to "Mon DD – Mon DD YYYY" human string */
function humanDates(start: string, end: string): string {
  if (!start) return '';
  const s = new Date(start + 'T12:00:00');
  if (isNaN(s.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (!end || end === start) {
    return s.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  }
  const e = new Date(end + 'T12:00:00');
  if (isNaN(e.getTime())) return s.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', opts)}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

/** Extract just the city part from "City, Country" */
function cityOnly(location: string): string {
  return location.split(',')[0].trim();
}

/** Detect whether a package is active (Yes / text following ":Yes") */
function isYes(text: string, pattern: RegExp): boolean {
  const m = text.match(pattern);
  if (!m) return false;
  // Check what follows the label
  const afterLabel = text.slice(m.index ?? 0, (m.index ?? 0) + 200);
  return /:\s*Yes/i.test(afterLabel);
}

// ─── Main parser ───────────────────────────────────────────────────────────────

export function parseSOWText(text: string): ParsedSOW {
  // ── Event code ──────────────────────────────────────────────────────────────
  const eventCode = pick(text,
    /Call Order #:\s*(J\w+)/i,
    /Call Order Number:\s*(J\w+)/i,
    /BPA Call Number:\s*(\w+)/i,
  );

  // ── Meeting name ────────────────────────────────────────────────────────────
  // Stop before the next SOW field label (pdfjs collapses lines into one long
  // string, so "Meeting Name: X Y Z Meeting Type: In-Person" is one line).
  const NEXT_FIELD = /\s+(?:Meeting Type|BPA Call|NOTES|Event Start|Event End|Modification|LEM Fluency|Basic Information|Background|Description)\s*[:/]/i;
  const meetingName = (() => {
    for (const re of [/Meeting Name:\s+(.*)/i, /Program Name:\s+(.*)/i]) {
      const m = text.match(re);
      if (!m) continue;
      const raw = m[1];
      const stopAt = raw.search(NEXT_FIELD);
      const value = (stopAt > 0 ? raw.slice(0, stopAt) : raw)
        .replace(/\s+/g, ' ')
        .trim();
      if (value) return value;
    }
    return '';
  })();

  // ── Dates ───────────────────────────────────────────────────────────────────
  const rawStart = pick(text, /Event Start Date:\s*(\d{2}\/\d{2}\/\d{2})/i);
  const rawEnd   = pick(text, /Event End Date:\s*(\d{2}\/\d{2}\/\d{2})/i);
  const startDate = parseMMDDYY(rawStart);
  const endDate   = parseMMDDYY(rawEnd);

  // ── Location ────────────────────────────────────────────────────────────────
  // Try explicit field first
  let location = pick(text,
    /Location of the Conference:\s*([^\n\r]+)/i,
  ).trim();

  // Description-based extraction — covers the two common SOW phrasings:
  //   "will take place from February 9-10, 2026 in Tunis, Tunisia"   (J144-style)
  //   "to take place in Astana, Kazakhstan from June 30-July 3, 2026" (J276-style)
  //   "will take place in [City], [Country] on/from/during …"         (generic)
  if (!location) {
    const patterns = [
      // "take place from [dates] in City, Country" — J144
      /take\s+place\s+from\s+[A-Za-z0-9\s,\-–]+\s+in\s+([A-Z][A-Za-zÀ-ÿ\s]+,\s*[A-Z][A-Za-zÀ-ÿ\s]+?)(?:\s*[\.\n]|\s+(?:There|from|on|during)\b)/i,
      // "take place in City, Country from/on …" — J276
      /take\s+place\s+in\s+([A-Z][A-Za-zÀ-ÿ\s]+,\s*[A-Z][A-Za-zÀ-ÿ\s]+?)(?:\s+from\b|\s+on\b|\s+during\b|\s*\.)/i,
      // "be held in City, Country"
      /(?:will\s+be\s+held|conducted|hosted|taking\s+place)\s+in\s+([A-Z][A-Za-zÀ-ÿ\s]+,\s*[A-Z][A-Za-zÀ-ÿ\s]+?)(?:\s+from\b|\s+on\b|\s*\.|\s+\d)/i,
      // Generic "in City, Country from/on"
      /\bin\s+([A-Z][A-Za-zÀ-ÿ]+(?:\s+[A-Z][A-Za-zÀ-ÿ]+)?,\s*[A-Z][A-Za-zÀ-ÿ]+(?:\s+[A-Z][A-Za-zÀ-ÿ]+)?)\s+(?:from\b|on\b)/i,
    ];

    for (const re of patterns) {
      const m = text.match(re);
      if (m?.[1]) {
        location = m[1].trim().replace(/\s+/g, ' ');
        break;
      }
    }

    // Discard noise — only accept if it looks like "Word, Word" or "Word Word, Word"
    if (location && !/[A-Z][a-z]/.test(location)) location = '';
    // Strip trailing punctuation
    location = location.replace(/[.,;]+$/, '').trim();

    // Suppress false positives (common English phrases that aren't cities)
    const FALSE_POSITIVES = /^(this|that|which|each|any|all|its|the|our|your|their|a |an )/i;
    if (FALSE_POSITIVES.test(location)) location = '';
  }

  // Last resort: extract city from the meeting name suffix before a month abbreviation
  if (!location && meetingName) {
    const m = meetingName.match(/([A-Z][a-z]{2,})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
    if (m) location = m[1];
  }

  const city = cityOnly(location);

  // ── Meeting type ────────────────────────────────────────────────────────────
  const meetingType = pick(text,
    /Meeting Type:\s*([^\n\r\t]+)/i,
  ).trim();

  // ── Language ────────────────────────────────────────────────────────────────
  const language = pick(text,
    /LEM Fluency(?:\s*\(if applicable\))?:\s*([^\n\r\t,]+)/i,
    /Interpretation Language:\s*([^\n\r\t]+)/i,
    /Language of communication with.*?participants?:\s*([^\n\r\t]+)/i,
  ).trim();

  // ── Participants ─────────────────────────────────────────────────────────────
  const totalParticipants = pick(text,
    /total of (\d+)\s+(?:participants|travelers)/i,
    /(\d+)\s+total\s+(?:participants|travelers)/i,
    /Number of Participants:\s*(\d+)/i,
    /Total.*?number of attendees.*?:\s*(\d+)/i,
    /(\d+)\s+total travelers/i,
  );

  // ── Setup style ──────────────────────────────────────────────────────────────
  const setupRaw = pick(text,
    /Style of the conference venue\s*\([^)]*\):\s*([^\n\r.]+)/i,
    /Set.?up.*?style:\s*([^\n\r.]+)/i,
    /(?:Classroom|Theatre|Cabaret|U-Shape|Boardroom)/i,
  ).trim();
  // Normalise to known values
  const setupStyle = (() => {
    const s = setupRaw.toLowerCase();
    if (s.includes('classroom'))  return 'Classroom';
    if (s.includes('cabaret'))    return 'Cabaret';
    if (s.includes('theatre') || s.includes('theater')) return 'Theatre';
    if (s.includes('u-shape') || s.includes('ushape')) return 'U-Shape';
    if (s.includes('boardroom'))  return 'Boardroom';
    return '';
  })();

  // ── Financial fields ─────────────────────────────────────────────────────────
  const maxGroundTransport = pick(text,
    /Maximum amount.*?ground transportation per traveler:\s*\$?([\d,]+)/i,
    /ground transportation.*?up to.*?\$?([\d,]+)/i,
  ).replace(/,/g, '');

  // Visa: look for the amount in the Visa/Passport section
  const visaSection = text.match(/Visa\/Passport[\s\S]{0,400}/i)?.[0] ?? '';
  const maxVisaAllowance = pick(visaSection,
    /[Cc]urrent amount per person:\s*\$?([\d,]+)/i,
    /[Aa]mount.*?per person:\s*\$?([\d,]+)/i,
  ).replace(/,/g, '');

  // Per diem rate: look for a daily M&IE rate (less reliable in SOW)
  const perDiemRate = '';

  // ── Packages ─────────────────────────────────────────────────────────────────
  const packages: SOWPackages = {
    fullLEM:         isYes(text, /Local Event Management Full Support Package/i),
    minimalLEM:      isYes(text, /Local Event Management Minimal Support Package/i),
    venue:           isYes(text, /Conference Venue Package/i),
    language:        isYes(text, /Foreign Language Package/i),
    printing:        isYes(text, /Supplies and Print Materials Package/i),
    travelServices:  isYes(text, /Travel Services/i),
    catering:        isYes(text, /Catering.*?Package/i) ||
                     /[Cc]atering.*?(?:LEM|Yes)/m.test(text),
    registration:    isYes(text, /(?:Conference and Course )?Registration Package/i) ||
                     /Number of Participants.*?registration/i.test(text),
    photography:     /[Pp]hotography.*?[Vv]ideography/i.test(text),
    internet:        /[Ii]nternet [Aa]ccess/i.test(text),
    perDiem:         /Per Diem Allowances/i.test(text),
    lodging:         /Lodging.*?arrangement/i.test(text),
    groundTransport: /[Gg]round [Tt]ransportation/i.test(text),
    interpretation:  isYes(text, /Foreign Language Package/i) ||
                     /[Ss]imultaneous [Ii]nterpretation/i.test(text),
  };

  // ── Template suggestions based on packages ───────────────────────────────────
  const suggestedTemplateIds: string[] = ['tpl-sow'];
  if (packages.fullLEM || packages.minimalLEM) suggestedTemplateIds.push('tpl-lem');
  if (packages.venue)           suggestedTemplateIds.push('tpl-venue', 'tpl-av', 'tpl-av-equipment');
  if (packages.interpretation)  suggestedTemplateIds.push('tpl-interpretation');
  if (packages.printing)        suggestedTemplateIds.push('tpl-printing');
  if (packages.registration)    suggestedTemplateIds.push('tpl-registration');
  if (packages.catering)        suggestedTemplateIds.push('tpl-catering');
  if (packages.photography)     suggestedTemplateIds.push('tpl-photography');
  if (packages.internet)        suggestedTemplateIds.push('tpl-internet');
  if (packages.perDiem)         suggestedTemplateIds.push('tpl-per-diem', 'tpl-per-diem-form');
  if (packages.lodging)         suggestedTemplateIds.push('tpl-lodging');
  if (packages.groundTransport) suggestedTemplateIds.push('tpl-transportation', 'tpl-transfer');

  // ── Notes (assembled from key SOW facts) ─────────────────────────────────────
  const noteLines: string[] = [];
  if (meetingType)        noteLines.push(`Meeting type: ${meetingType}`);
  if (totalParticipants)  noteLines.push(`Total participants: ${totalParticipants}`);
  if (setupStyle)         noteLines.push(`Room setup: ${setupStyle}`);
  if (language)           noteLines.push(`LEM fluency / interpretation: ${language}`);
  if (maxGroundTransport) noteLines.push(`Max ground transport reimbursement: $${maxGroundTransport}`);
  if (maxVisaAllowance)   noteLines.push(`Max visa reimbursement: $${maxVisaAllowance}`);
  const notes = noteLines.join('\n');

  return {
    eventCode,
    meetingName,
    location,
    city,
    startDate,
    endDate,
    dates: humanDates(startDate, endDate),
    meetingType,
    language,
    totalParticipants,
    setupStyle,
    notes,
    perDiemRate,
    maxVisaAllowance,
    maxGroundTransport,
    packages,
    suggestedTemplateIds,
    rawText: text,
  };
}

export async function parseSOWPdf(file: File): Promise<ParsedSOW> {
  const text = await extractPdfText(file);
  return parseSOWText(text);
}
