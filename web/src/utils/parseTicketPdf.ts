/**
 * Parses a PSA/CTM e-invoice PDF (electronic itinerary) and extracts the
 * traveler's name plus the inbound and outbound legs to/from the project city.
 *
 * Designed for CTM itinerary PDFs which follow a predictable structure:
 *   LASTNAME/FIRSTNAME MIDDLENAME   Ref: JXXX
 *   DATE: DayOfWeek, Mon DD
 *   Flight AIRLINE FLIGHTNO [Operated by AIRLINE]
 *   From  CITY, COUNTRY
 *   Departs  HH:MMam/pm
 *   To  CITY, COUNTRY     Arrives  HH:MMam/pm (+1 day)?
 */
import * as pdfjsLib from 'pdfjs-dist';

// Use Vite's ?url import for the worker to avoid bundling issues
// @ts-ignore — Vite resolves this at build time
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ParsedTicketResult {
  /** Display name: "Firstname Lastname" */
  firstName:        string;
  lastName:         string;
  /** ISO date "YYYY-MM-DD" or '' */
  arrivalDate:      string;
  /** e.g. "LUFTHANSA 8756" */
  arrivalFlight:    string;
  /** "HH:MM" 24-h */
  arrivalTime:      string;
  arrivalCity:      string;
  departureDate:    string;
  departureFlight:  string;
  departureTime:    string;
  departureCity:    string;
}

// ─── PDF text extraction ──────────────────────────────────────────────────

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
  }
  return parts.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12,
};

function parseTime12(raw: string): string {
  // "6:20pm" → "18:20",  "3:55am" → "03:55",  "11:15am" → "11:15"
  const m = raw.replace(/\s/g, '').match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const mn = m[2];
  const ap = m[3].toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mn}`;
}

/** Parse "Mon DD" with a given year into ISO "YYYY-MM-DD".
 *  Uses local date arithmetic — avoids toISOString() UTC shift
 *  (which would flip midnight to the previous day in UTC+N timezones). */
function parseSegmentDate(raw: string, year: number, plusDays = 0): string {
  const m = raw.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!m) return '';
  const month = MONTH_MAP[m[1]];
  if (!month) return '';
  // Use Date only for carry arithmetic (e.g. Jun 30 + 1 → Jul 01)
  const d = new Date(year, month - 1, parseInt(m[2], 10) + plusDays);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

/** Extract year from "DD Mon YYYY" invoice date line, fallback to current year. */
function inferYear(text: string): number {
  const m = text.match(/INVOICE ISSUE DATE\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
         ?? text.match(/\b(20\d{2})\b/);
  if (m) return parseInt(m[m.length - 1], 10);
  return new Date().getFullYear();
}

// ─── Segment parser ────────────────────────────────────────────────────────

interface FlightSegment {
  dateLabel:    string;   // "Jun 03"
  airline:      string;   // "LUFTHANSA"
  flightNo:     string;   // "8756"
  fromCity:     string;   // "MUNICH, GERMANY"
  toCity:       string;   // "TBILISI, GEORGIA"
  departTime:   string;   // "22:00"
  arriveTime:   string;   // "03:55"
  plusOnDay:    boolean;  // "Arrives ... (+1 day)"
}

/**
 * Normalise airline name to operator: if "Operated by X" is present, use X.
 * Returns { airline, flightNo }.
 */
function parseFlightLine(raw: string): { airline: string; flightNo: string } {
  // "UNITED AIRLINES 8756 Operated by LUFTHANSA"
  // "LUFTHANSA 2559"
  const opMatch = raw.match(/Operated\s+by\s+([A-Z &]+\b\s*[A-Z]*)/i);
  const mainMatch = raw.match(/^Flight\s+(.*?)\s+(\d+)\s*(Operated.*)?$/i);
  if (!mainMatch) return { airline: '', flightNo: '' };
  const airline = opMatch
    ? opMatch[1].trim()
    : mainMatch[1].trim();
  return { airline, flightNo: mainMatch[2] };
}

function parseSegments(text: string): FlightSegment[] {
  // Split on "DATE:" markers
  const chunks = text.split(/DATE\s*:/i).slice(1);
  const segments: FlightSegment[] = [];

  for (const chunk of chunks) {
    // Date label e.g. "Tue, Jun 02" → extract "Jun 02"
    const dateM = chunk.match(/[A-Za-z]{3},\s*([A-Za-z]{3}\s+\d{1,2})/);
    const dateLabel = dateM ? dateM[1] : '';

    // Flight line (may span a couple of tokens — look for pattern)
    const flightM = chunk.match(/Flight\s+([\w\s]+?\d+(?:\s+Operated\s+by\s+[\w\s]+)?)/i);
    if (!flightM) continue;
    const { airline, flightNo } = parseFlightLine('Flight ' + flightM[1]);

    // From / Departs
    const fromM  = chunk.match(/From\s+([\w\s,]+?)(?=\s*Departs|\s*To\b|\s*Departure)/i);
    const departM = chunk.match(/Departs\s+([\d:apmPMAM]+)/i);

    // To / Arrives
    const toM    = chunk.match(/To\s+([\w\s,]+?)(?=\s*Arrives|\s*Arrival|\s*Duration|\s*Departure)/i);
    const arriveM = chunk.match(/Arrives?\s+([\d:apmPMAM]+)/i);
    const plusOne = /\(\s*\+\s*1\s*day\s*\)/i.test(chunk);

    segments.push({
      dateLabel:  dateLabel,
      airline:    airline.toUpperCase(),
      flightNo,
      fromCity:   fromM   ? fromM[1].trim().toUpperCase()   : '',
      toCity:     toM     ? toM[1].trim().toUpperCase()     : '',
      departTime: departM ? parseTime12(departM[1]) : '',
      arriveTime: arriveM ? parseTime12(arriveM[1]) : '',
      plusOnDay:  plusOne,
    });
  }
  return segments;
}

// ─── Main function ────────────────────────────────────────────────────────

/**
 * Parse a CTM e-invoice PDF and extract the name + relevant legs.
 * @param file       The PDF File to parse.
 * @param projectCity The project/event city (e.g. "Tbilisi") to match legs.
 */
export async function parseTicketPdf(
  file:        File,
  projectCity: string,
): Promise<ParsedTicketResult> {
  const text       = await extractPdfText(file);
  const year       = inferYear(text);
  const segments   = parseSegments(text);
  const cityUpper  = projectCity.trim().toUpperCase();

  // ── Traveler name ──────────────────────────────────────────────────────
  // Format: "LASTNAME/FIRSTNAME MIDDLENAME" or "LASTNAME/FIRSTNAME"
  const nameM = text.match(/([A-Z]+)\/([A-Z]+(?: [A-Z]+)?)/);
  let firstName = '';
  let lastName  = '';
  if (nameM) {
    lastName  = nameM[1];
    const parts = nameM[2].split(' ');
    // Capitalise each part
    const fmt = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
    firstName = parts.map(fmt).join(' ');
    lastName  = fmt(lastName);
  }

  // ── Find arrival leg: "To" city contains project city ─────────────────
  const arrSeg = segments.find((s) => s.toCity.includes(cityUpper));
  let arrivalDate     = '';
  let arrivalFlight   = '';
  let arrivalTime     = '';
  let arrivalCity     = '';
  if (arrSeg) {
    const offset = arrSeg.plusOnDay ? 1 : 0;
    arrivalDate   = parseSegmentDate(arrSeg.dateLabel, year, offset);
    arrivalFlight = `${arrSeg.airline} ${arrSeg.flightNo}`;
    arrivalTime   = arrSeg.arriveTime;
    arrivalCity   = arrSeg.toCity;
  }

  // ── Find departure leg: "From" city contains project city ─────────────
  const depSeg = segments.find((s) => s.fromCity.includes(cityUpper));
  let departureDate    = '';
  let departureFlight  = '';
  let departureTime    = '';
  let departureCity    = '';
  if (depSeg) {
    departureDate   = parseSegmentDate(depSeg.dateLabel, year);
    departureFlight = `${depSeg.airline} ${depSeg.flightNo}`;
    departureTime   = depSeg.departTime;
    departureCity   = depSeg.fromCity;
  }

  return {
    firstName,
    lastName,
    arrivalDate,
    arrivalFlight,
    arrivalTime,
    arrivalCity,
    departureDate,
    departureFlight,
    departureTime,
    departureCity,
  };
}
