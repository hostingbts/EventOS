import type { Event } from '../types';

/**
 * Context used to interpolate {{variables}} inside a template's title and
 * instructions before saving the resulting task.
 */
export interface TemplateContext {
  event: Event;
  vendorName?: string;
  vendorCategory?: string;
}

/**
 * The variables we know how to expand. Keep this in sync with the
 * `TemplateVariable` type in `types.ts`.
 */
export const KNOWN_VARIABLES: { name: string; description: string; example: string }[] = [
  { name: 'event_code', description: 'Project code', example: 'J182-4' },
  { name: 'event_name', description: 'Project code + location', example: 'J182-4 — Tbilisi' },
  { name: 'city', description: 'Event city / location', example: 'Tbilisi' },
  { name: 'venue', description: 'Event venue', example: 'Hilton' },
  { name: 'dates', description: 'Human date range', example: 'May 1-2' },
  { name: 'start_date', description: 'Start date (ISO)', example: '2026-05-01' },
  { name: 'end_date', description: 'End date (ISO)', example: '2026-05-02' },
  { name: 'month', description: 'Month + year label', example: 'May 2026' },
  { name: 'owner_email', description: 'Event owner email', example: 'sam@team.org' },
  { name: 'vendor_name', description: 'Vendor company/contact (if scoped)', example: 'ACME Audio' },
  { name: 'vendor_category', description: 'Vendor category (if scoped)', example: 'AV' },
  { name: 'per_diem_daily_rate', description: 'M&IE daily rate in USD (set on event)', example: '35' },
  { name: 'max_visa_allowance', description: 'Maximum visa reimbursement in USD', example: '250' },
  { name: 'max_ground_transport', description: 'Maximum ground transport reimbursement in USD', example: '60' },
];

function valueFor(ctx: TemplateContext, key: string): string {
  const e = ctx.event;
  switch (key) {
    case 'event_code':
      return e.code;
    case 'event_name':
      return e.location ? `${e.code} — ${e.location}` : e.code;
    case 'city':
      return e.location || '';
    case 'venue':
      return e.venue || '';
    case 'dates':
      return e.dates || '';
    case 'start_date':
      return e.startDate || '';
    case 'end_date':
      return e.endDate || '';
    case 'month':
      return e.monthGroup || '';
    case 'owner_email':
      return e.ownerEmail || '';
    case 'vendor_name':
      return ctx.vendorName || '';
    case 'vendor_category':
      return ctx.vendorCategory || '';
    case 'per_diem_daily_rate':
      return (e as unknown as Record<string, string>).perDiemRate || '';
    case 'max_visa_allowance':
      return (e as unknown as Record<string, string>).maxVisaAllowance || '';
    case 'max_ground_transport':
      return (e as unknown as Record<string, string>).maxGroundTransport || '';
    default:
      return '';
  }
}

/**
 * Renders all `{{variable}}` placeholders in the given string using values
 * from the event context. Unknown variables resolve to an empty string so
 * dangling braces don't appear in the final task content.
 */
export function renderTemplateString(input: string, ctx: TemplateContext): string {
  if (!input) return '';
  return input.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => {
    return valueFor(ctx, String(key).toLowerCase());
  });
}

/**
 * Computes a default due date for a template that has a `dueOffsetDays`
 * relative to the event start date. Returns an ISO date (YYYY-MM-DD) or ''.
 */
export function computeDueDate(startDate: string, offsetDays?: number): string {
  if (offsetDays === undefined || offsetDays === null) return '';
  if (!startDate) return '';
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
