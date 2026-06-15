/**
 * Parses a PSA/CLDP LEM Statement of Work (SOW) PDF.
 *
 * Supports common SOW layouts:
 *   - Standard header: Call Order #, Meeting Name, Meeting Type, Basic Information
 *   - Description block: "taking place in City, Country" / "to take place in …"
 *   - Draft Call Order Form filenames and CLDP NC modification filenames
 *
 * ~35% of real SOW PDFs use custom font encodings that garble text extraction.
 * When that happens we fall back to the filename for the event code and infer
 * city from the meeting name where possible.
 */
import { extractPdfText } from './pdfExtract';
import { formatDateRange } from './dateFormat';

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

export type SOWParseQuality = 'full' | 'partial' | 'minimal';

export interface ParsedSOW {
  eventCode:          string;
  meetingName:        string;
  location:           string;
  city:               string;
  startDate:          string;
  endDate:            string;
  dates:              string;
  meetingType:        string;
  language:           string;
  totalParticipants:  string;
  setupStyle:         string;
  notes:              string;
  perDiemRate:        string;
  maxVisaAllowance:   string;
  maxGroundTransport: string;
  packages:           SOWPackages;
  suggestedTemplateIds: string[];
  /** How much was extracted from PDF text vs filename heuristics */
  parseQuality:       SOWParseQuality;
  /** Non-fatal issues the user should review before generating */
  warnings:           string[];
  rawText:            string;
}

// ─── CLDP city → country (meeting-name / description inference) ────────────────

const CITY_COUNTRY: Record<string, string> = {
  Almaty: 'Kazakhstan',
  Astana: 'Kazakhstan',
  Tunis: 'Tunisia',
  Tunisia: 'Tunisia',
  Bangkok: 'Thailand',
  Thailand: 'Thailand',
  Stockholm: 'Sweden',
  Algiers: 'Algeria',
  Algeria: 'Algeria',
  Ulaanbaatar: 'Mongolia',
  Mongolia: 'Mongolia',
  Tashkent: 'Uzbekistan',
  Uzbekistan: 'Uzbekistan',
  Dushanbe: 'Tajikistan',
  Bishkek: 'Kyrgyz Republic',
  Colombo: 'Sri Lanka',
  'Sri Lanka': 'Sri Lanka',
  Tbilisi: 'Georgia',
  Georgia: 'Georgia',
  Istanbul: 'Turkey',
  Ankara: 'Turkey',
  Cairo: 'Egypt',
  Rabat: 'Morocco',
  Morocco: 'Morocco',
  Jakarta: 'Indonesia',
  Manila: 'Philippines',
  Hanoi: 'Vietnam',
  Dubai: 'UAE',
  Amman: 'Jordan',
  Beirut: 'Lebanon',
  Kuwait: 'Kuwait',
  Riyadh: 'Saudi Arabia',
  Lagos: 'Nigeria',
  Nairobi: 'Kenya',
  Accra: 'Ghana',
  Dakar: 'Senegal',
  Kyiv: 'Ukraine',
  Warsaw: 'Poland',
  Bucharest: 'Romania',
  Sarajevo: 'Bosnia and Herzegovina',
  Singapore: 'Singapore',
  Kuala: 'Malaysia',
  Lima: 'Peru',
  Bogota: 'Colombia',
  Mexico: 'Mexico',
  Santiago: 'Chile',
  Buenos: 'Argentina',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

function parseMMDDYY(raw: string): string {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{2})/);
  if (!m) return '';
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm}-${dd}`;
}

function humanDates(start: string, end: string): string {
  return formatDateRange(start, end);
}

function cityOnly(location: string): string {
  return location.split(',')[0].trim();
}

function isYes(text: string, pattern: RegExp): boolean {
  const m = text.match(pattern);
  if (!m) return false;
  const afterLabel = text.slice(m.index ?? 0, (m.index ?? 0) + 200);
  return /:\s*Yes\b/i.test(afterLabel);
}

/** True when pdf.js extracted usable SOW field labels (many PDFs use custom fonts). */
export function isSowTextReadable(text: string): boolean {
  const head = text.slice(0, 5000);
  const signals = [
    /Call Order\s*#:/i.test(head),
    /Meeting Name:/i.test(head),
    /Event Start Date:/i.test(head),
    /LEM TASKS:/i.test(head),
  ];
  return signals.filter(Boolean).length >= 2;
}

/** Extract J-code from common CLDP filename patterns. */
export function parseEventCodeFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const patterns = [
    /\b(J\d{2,4})\b/i,
    /Call\s*Order\s*Form[_\s-]*(J\d+)/i,
    /CLDP\s*NC\s*-\s*(J\d+)/i,
    /LEM[_\s-]*SOW[_\s-]*(J\d+)/i,
  ];
  for (const re of patterns) {
    const m = base.match(re);
    if (m) return m[1].toUpperCase();
  }
  return '';
}

function descriptionSection(text: string): string {
  const m = text.match(
    /Description:\s*([\s\S]*?)(?:Notables outside|LEM TASKS:|FOR INFORMATIONAL PURPOSES|$)/i,
  );
  return m?.[1]?.trim() ?? '';
}

function cleanLocation(raw: string): string {
  let location = raw.trim().replace(/\s+/g, ' ').replace(/[.,;]+$/, '').trim();
  const FALSE_POSITIVES = /^(this|that|which|each|any|all|its|the|our|your|their|a |an )/i;
  if (!location || !/[A-Z][a-z]/.test(location) || FALSE_POSITIVES.test(location)) return '';
  return location;
}

function inferLocationFromText(text: string): string {
  const desc = descriptionSection(text);
  const sources = [desc, text];

  const patterns = [
    // "(1) Dushanbe, Tajikistan on July 15-17"
    /\(\d+\)\s+([A-Z][A-Za-zÀ-ÿ'.\s-]+,\s*[A-Z][A-Za-zÀ-ÿ'.\s-]+?)\s+on\b/i,
    // "taking place in Tunis, Tunisia"
    /taking\s+place\s+in\s+([A-Z][A-Za-zÀ-ÿ'.\s-]+,\s*[A-Z][A-Za-zÀ-ÿ'.\s-]+?)(?:\s+and|\s+will|\s*\.|,|\s+from\b)/i,
    // "to take place in Almaty, Kazakhstan during/from/on"
    /to\s+take\s+place\s+in\s+([A-Z][A-Za-zÀ-ÿ'.\s-]+,\s*[A-Z][A-Za-zÀ-ÿ'.\s-]+?)(?:\s+during\b|\s+from\b|\s+on\b|\s*\.)/i,
    // "take place from [dates] in City, Country" — J144-style
    /take\s+place\s+from\s+[A-Za-z0-9\s,\-–]+\s+in\s+([A-Z][A-Za-zÀ-ÿ'.\s-]+,\s*[A-Z][A-Za-zÀ-ÿ'.\s-]+?)(?:\s*[\.\n]|\s+(?:There|from|on|during|and)\b)/i,
    // "be held in City, Country"
    /(?:will\s+be\s+held|conducted|hosted|taking\s+place)\s+in\s+([A-Z][A-Za-zÀ-ÿ'.\s-]+,\s*[A-Z][A-Za-zÀ-ÿ'.\s-]+?)(?:\s+from\b|\s+on\b|\s*\.|\s+\d)/i,
    // "workshop from …, taking place in City, Country"
    /from\s+[A-Za-z0-9\s,\-–]+,\s+taking\s+place\s+in\s+([A-Z][A-Za-zÀ-ÿ'.\s-]+,\s*[A-Z][A-Za-zÀ-ÿ'.\s-]+)/i,
    // Explicit field (some templates)
    /Location of the Conference:\s*([^\n\r]+)/i,
  ];

  for (const source of sources) {
    for (const re of patterns) {
      const m = source.match(re);
      if (m?.[1]) {
        const loc = cleanLocation(m[1]);
        if (loc) return loc;
      }
    }
  }
  return '';
}

function cityFromMeetingName(meetingName: string): string {
  if (!meetingName) return '';

  if (/\bTUN\b/.test(meetingName)) return 'Tunis';

  const tokens = Object.keys(CITY_COUNTRY).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(meetingName)) {
      if (/^Tunisia$/i.test(token)) return 'Tunis';
      return token;
    }
  }

  const beforeMonth = meetingName.match(
    /\b([A-Z][a-z]{2,})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2}\b/,
  );
  if (beforeMonth?.[1]) return beforeMonth[1];

  return '';
}

function locationFromCity(city: string): string {
  if (!city) return '';
  const country = CITY_COUNTRY[city];
  if (country && city.toLowerCase() !== country.toLowerCase()) {
    return `${city}, ${country}`;
  }
  return city;
}

function assessParseQuality(fields: {
  eventCode: string;
  startDate: string;
  endDate: string;
  meetingName: string;
  location: string;
  readable: boolean;
}): SOWParseQuality {
  const hasCore =
    fields.eventCode &&
    fields.startDate &&
    fields.endDate &&
    (fields.location || fields.meetingName);
  if (hasCore && fields.readable) return 'full';

  if (fields.eventCode && (fields.startDate || fields.meetingName)) return 'partial';
  if (fields.eventCode) return 'minimal';
  return 'minimal';
}

function buildWarnings(fields: {
  readable: boolean;
  eventCode: string;
  fromFilename: boolean;
  startDate: string;
  endDate: string;
  location: string;
  meetingName: string;
  totalParticipants: string;
}): string[] {
  const warnings: string[] = [];

  if (!fields.readable) {
    warnings.push(
      'PDF text could not be read reliably (custom font encoding). Values were inferred from the filename and any readable fragments — review all fields before generating.',
    );
  }
  if (fields.fromFilename && fields.eventCode) {
    warnings.push(`Event code ${fields.eventCode} was taken from the filename.`);
  }
  if (!fields.startDate || !fields.endDate) {
    warnings.push('Event dates were not found — enter start and end dates manually.');
  }
  if (!fields.location && !fields.meetingName) {
    warnings.push('Location and meeting name were not found — fill these in manually.');
  } else if (!fields.location) {
    warnings.push('Location was inferred from the meeting name — verify city and country.');
  }
  if (!fields.totalParticipants) {
    warnings.push('Participant count was not detected.');
  }

  return warnings;
}

// ─── Main parser ───────────────────────────────────────────────────────────────

export function parseSOWText(text: string, filename = ''): ParsedSOW {
  const readable = isSowTextReadable(text);
  const desc = descriptionSection(text);

  // ── Event code ──────────────────────────────────────────────────────────────
  let eventCode = pick(text,
    /Call Order #:\s*(J\w+)/i,
    /Call Order Number:\s*(J\w+)/i,
    /BPA Call Number:\s*(J\w+)/i,
  );
  const codeFromFile = !eventCode ? parseEventCodeFromFilename(filename) : '';
  if (!eventCode && codeFromFile) eventCode = codeFromFile;

  // ── Meeting name ────────────────────────────────────────────────────────────
  const NEXT_FIELD = /\s+(?:Meeting Type|Version:|NOTES|Event Start|Event End|Modification|LEM Fluency|Basic Information|Background|Description)\s*[:/]/i;
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
  let startDate = parseMMDDYY(rawStart);
  let endDate   = parseMMDDYY(rawEnd);

  // Description fallback: "from June 10-11, 2026"
  if (!startDate || !endDate) {
    const range = desc.match(
      /from\s+([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})/i,
    );
    if (range) {
      const months: Record<string, string> = {
        january: '01', february: '02', march: '03', april: '04',
        may: '05', june: '06', july: '07', august: '08',
        september: '09', october: '10', november: '11', december: '12',
        jan: '01', feb: '02', mar: '03', apr: '04',
        jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      const mm = months[range[1].toLowerCase()];
      if (mm) {
        const y = range[4];
        const d1 = range[2].padStart(2, '0');
        const d2 = range[3].padStart(2, '0');
        if (!startDate) startDate = `${y}-${mm}-${d1}`;
        if (!endDate) endDate = `${y}-${mm}-${d2}`;
      }
    }
  }

  // ── Location ────────────────────────────────────────────────────────────────
  let location = inferLocationFromText(text);

  if (!location && meetingName) {
    const inferredCity = cityFromMeetingName(meetingName);
    location = locationFromCity(inferredCity);
  }

  if (!location && meetingName) {
    const m = meetingName.match(/([A-Z][a-z]{2,})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
    if (m) location = locationFromCity(m[1]);
  }

  const city = cityOnly(location);

  // ── Meeting type ────────────────────────────────────────────────────────────
  const meetingType = pick(text, /Meeting Type:\s*([^\n\r\t]+)/i)
    .replace(/\s+NOTES:.*/i, '')
    .replace(/\s+Version:.*/i, '')
    .trim();

  // ── Language ────────────────────────────────────────────────────────────────
  const language = pick(text,
    /LEM Fluency(?:\s*\(if applicable\))?:\s*([^\n\r\t,]+)/i,
    /Interpretation Language:\s*([^\n\r\t]+)/i,
    /Language of communication with.*?participants?:\s*([^\n\r\t]+)/i,
  )
    .replace(/\s+Background:.*/i, '')
    .trim();

  // ── Participants ────────────────────────────────────────────────────────────
  const totalParticipants = pick(text,
    /will have (\d+)\s+participants/i,
    /total of (\d+)\s+(?:participants|travelers)/i,
    /(\d+)\s+total\s+(?:participants|travelers)/i,
    /Number of Participants:\s*(\d+)/i,
    /Total.*?number of attendees.*?:\s*(\d+)/i,
    /(\d+)\s+total travelers/i,
    /(\d+)\s+participants/i,
  );

  // ── Setup style ──────────────────────────────────────────────────────────────
  const setupRaw = pick(text,
    /Style of the conference venue\s*\([^)]*\):\s*([^\n\r.]+)/i,
    /Set.?up.*?style:\s*([^\n\r.]+)/i,
    /(?:Classroom|Theatre|Cabaret|U-Shape|Boardroom)/i,
  ).trim();
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

  const visaSection = text.match(/Visa\/Passport[\s\S]{0,400}/i)?.[0] ?? '';
  const maxVisaAllowance = pick(visaSection,
    /[Cc]urrent amount per person:\s*\$?([\d,]+)/i,
    /[Aa]mount.*?per person:\s*\$?([\d,]+)/i,
  ).replace(/,/g, '');

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

  const noteLines: string[] = [];
  if (meetingType)        noteLines.push(`Meeting type: ${meetingType}`);
  if (totalParticipants)  noteLines.push(`Total participants: ${totalParticipants}`);
  if (setupStyle)         noteLines.push(`Room setup: ${setupStyle}`);
  if (language)           noteLines.push(`LEM fluency / interpretation: ${language}`);
  if (maxGroundTransport) noteLines.push(`Max ground transport reimbursement: $${maxGroundTransport}`);
  if (maxVisaAllowance)   noteLines.push(`Max visa reimbursement: $${maxVisaAllowance}`);
  if (desc && desc.length < 500) noteLines.push(`Description excerpt: ${desc.slice(0, 280)}…`);
  const notes = noteLines.join('\n');

  const parseQuality = assessParseQuality({
    eventCode,
    startDate,
    endDate,
    meetingName,
    location,
    readable,
  });

  const warnings = buildWarnings({
    readable,
    eventCode,
    fromFilename: !!codeFromFile && eventCode === codeFromFile,
    startDate,
    endDate,
    location,
    meetingName,
    totalParticipants,
  });

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
    parseQuality,
    warnings,
    rawText: text,
  };
}

export async function parseSOWPdf(file: File): Promise<ParsedSOW> {
  const text = await extractPdfText(file);
  return parseSOWText(text, file.name);
}
