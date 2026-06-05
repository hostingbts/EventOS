import type { TaskTemplate, TaskTemplateWithFiles, TemplateFile, VendorLink } from '../types';
import {
  deactivateVendorLink,
  generateVendorToken,
  getVendorLinkByEvent,
  getVendorLinksForEvent,
  setVendorLink,
} from './mockStore';

const templates: TaskTemplate[] = [
  {
    templateId: 'tpl-sow',
    title: 'SOW review & sign-off — {{event_code}}',
    category: 'SOW',
    instructions:
      'Review the Statement of Work received from PSA for {{event_name}}.\n\n' +
      '1. Identify all LEM responsibilities listed in the SOW.\n' +
      '2. Confirm attendee count, event format, and special requirements.\n' +
      '3. Upload the signed SOW PDF to this task.\n' +
      '4. Flag any missing information back to PSA before proceeding.\n\n' +
      'Assigned member: {{owner_email}} · Event dates: {{dates}} · Venue: {{venue}}',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 1,
    active: 'yes',
    dueOffsetDays: -28,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-venue',
    title: 'Venue coordination — {{venue}}',
    category: 'Venue',
    instructions:
      'Coordinate venue logistics for {{event_name}} in {{city}} ({{dates}}).\n\n' +
      '1. Confirm final room capacity and seating layout.\n' +
      '2. Agree on load-in / load-out times with venue contact.\n' +
      '3. Obtain floor plans for AV, interpretation, and registration placement.\n' +
      '4. Confirm Wi-Fi credentials and AV connection points.\n' +
      '5. Upload signed venue contract and floor plan to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 2,
    active: 'yes',
    dueOffsetDays: -21,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-av',
    title: 'AV & technical setup — {{city}}',
    category: 'AV',
    instructions:
      'Manage AV and technical requirements for {{event_code}} at {{venue}} on {{dates}}.\n\n' +
      '1. Confirm microphone types (lapel, handheld, podium) and quantities.\n' +
      '2. Confirm projection/screen requirements and aspect ratio.\n' +
      '3. Confirm recording requirements (video/audio).\n' +
      '4. Book AV vendor and share floor plan.\n' +
      '5. Schedule rehearsal/sound-check slot minimum 2 hours before opening.\n' +
      '6. Upload AV quote and setup confirmation to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 3,
    active: 'yes',
    dueOffsetDays: -14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-interpretation',
    title: 'Interpretation setup — {{city}}',
    category: 'Interpretation',
    instructions:
      'Arrange interpretation services for {{event_name}} ({{dates}}).\n\n' +
      '1. Confirm source language and all target languages from the SOW.\n' +
      '2. Confirm number of interpretation booths required.\n' +
      '3. Book interpreters and issue briefing documents.\n' +
      '4. Coordinate booth placement on the floor plan with venue.\n' +
      '5. Confirm receiver/headset quantities for delegates.\n' +
      '6. Upload interpretation confirmation and booth specs to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 4,
    active: 'yes',
    dueOffsetDays: -14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-transportation',
    title: 'Airport transportation — {{city}}',
    category: 'Transportation',
    instructions:
      'Organise airport transfer logistics for {{event_name}} in {{city}}.\n\n' +
      '1. Collect all arrival and departure flight details from delegates.\n' +
      '2. Group delegates by arrival window (max 2-hour slots per vehicle).\n' +
      '3. Book appropriate vehicles (minibus / sedan) per group.\n' +
      '4. Confirm driver contact details and share with delegates.\n' +
      '5. Prepare and upload transfer schedule to this task.\n' +
      '6. Brief drivers with hotel/venue address, parking, and timing.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 5,
    active: 'yes',
    dueOffsetDays: -7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-registration',
    title: 'Registration desk setup — {{venue}}',
    category: 'Registration',
    instructions:
      'Set up the delegate registration desk for {{event_name}} ({{dates}}) at {{venue}}.\n\n' +
      '1. Prepare the delegate list and print alphabetical sign-in sheets.\n' +
      '2. Confirm desk location with venue — near main entrance, good signage.\n' +
      '3. Arrange required equipment: laptop, printer, scanner, stationery.\n' +
      '4. Prepare welcome packs / lanyards / materials for each delegate.\n' +
      '5. Brief registration staff on check-in procedure and escalation contacts.\n' +
      '6. Upload final delegate list and welcome pack checklist to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 6,
    active: 'yes',
    dueOffsetDays: -3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-printing',
    title: 'Name badges & printing — {{event_name}}',
    category: 'Printing',
    instructions:
      'Manage all printing requirements for {{event_name}} ({{dates}}).\n\n' +
      '1. Confirm final delegate list and badge format (name, title, org, colour coding).\n' +
      '2. Design and print name badges — include lanyards.\n' +
      '3. Print agenda booklets, table cards, directional signage.\n' +
      '4. Print banners (confirm dimensions with venue).\n' +
      '5. Prepare spare blank badges for on-site additions.\n' +
      '6. Upload print-ready files and vendor confirmation to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 7,
    active: 'yes',
    dueOffsetDays: -5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-catering',
    title: 'Catering coordination — {{city}}',
    category: 'Catering',
    instructions:
      'Arrange catering for {{event_name}} at {{venue}} on {{dates}}.\n\n' +
      '1. Confirm headcount and any dietary restrictions from delegate list.\n' +
      '2. Agree menu with venue/caterer (coffee breaks, lunch, dinner if applicable).\n' +
      '3. Confirm service times aligned with agenda.\n' +
      '4. Confirm halal, vegetarian, vegan, and allergy-safe options.\n' +
      '5. Upload catering quote and confirmed menu to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 8,
    active: 'yes',
    dueOffsetDays: -7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-photography',
    title: 'Photography & video — {{event_name}}',
    category: 'Photography',
    instructions:
      'Coordinate photography and video coverage for {{event_name}} ({{dates}}) in {{city}}.\n\n' +
      '1. Confirm scope: event photography only, or also video recording?\n' +
      '2. Book photographer/videographer and share the agenda and floor plan.\n' +
      '3. Brief photographer on key moments: opening, panel sessions, group photo.\n' +
      '4. Confirm image delivery timeline and format (RAW/JPEG, Google Drive link).\n' +
      '5. Upload photographer brief and confirmation to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 9,
    active: 'yes',
    dueOffsetDays: -10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-internet',
    title: 'Internet & connectivity — {{venue}}',
    category: 'AV',
    instructions:
      'Ensure reliable internet for {{event_name}} at {{venue}} ({{dates}}).\n\n' +
      '1. Obtain venue Wi-Fi credentials and test speed (min 50 Mbps recommended).\n' +
      '2. Confirm number of simultaneous connections needed.\n' +
      '3. If venue Wi-Fi is insufficient, arrange 4G/5G router or dedicated line.\n' +
      '4. Prepare printed Wi-Fi credentials card for registration desk.\n' +
      '5. Test interpretation streaming platform connectivity on-site.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 10,
    active: 'yes',
    dueOffsetDays: -3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-lodging',
    title: 'Hotel & lodging — {{city}}',
    category: 'Travel',
    instructions:
      'Coordinate hotel accommodation for {{event_name}} delegates in {{city}}.\n\n' +
      '1. Confirm number of rooms required and check-in / check-out dates.\n' +
      '2. Block rooms at agreed hotel (or use hotel if same as {{venue}}).\n' +
      '3. Share hotel address, check-in instructions, and booking reference with delegates.\n' +
      '4. Confirm breakfast inclusion and any special requests.\n' +
      '5. Upload room list and hotel confirmation to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 11,
    active: 'yes',
    dueOffsetDays: -14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-lem',
    title: 'LEM on-site coordination — {{event_name}}',
    category: 'LEM',
    instructions:
      'Overall LEM on-site readiness for {{event_code}} in {{city}} on {{dates}}.\n\n' +
      '1. Confirm LEM scope from SOW is fully covered by task list.\n' +
      '2. Prepare on-site operations manual (contacts, timeline, escalation).\n' +
      '3. Conduct pre-event walkthrough with venue at least 24 hours before.\n' +
      '4. Confirm all vendor arrival times and on-site contacts.\n' +
      '5. Brief all team members on their roles and the run-of-show.\n' +
      '6. Upload the final run-of-show schedule to this task.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 12,
    active: 'yes',
    dueOffsetDays: -2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-per-diem',
    title: 'Per diem distribution — {{event_name}}',
    category: 'Finance',
    instructions:
      'Distribute M&IE (per diem) and reimbursements to delegates on-site at {{event_name}} in {{city}} ({{dates}}).\n\n' +
      'USE THE ATTACHED "Per Diem Distribution" FORM for every traveler.\n\n' +
      '— HOW TO COMPLETE THE FORM —\n\n' +
      'Section 1 · M&IE (Meals & Incidental Expenses)\n' +
      '• Calculate: USG daily rate × number of travel days (check SOW for the approved rate).\n' +
      '• PSA pays M&IE on the day of arrival in the country.\n' +
      '• If breakfast is included in the lodging rate (but not complimentary), deduct accordingly per FTR.\n' +
      '• Deduct meals provided on all workshop days.\n' +
      '• Record the currency of payment (usually EUR) and the USD equivalent.\n' +
      '• Do NOT write anything in the green traveler signature box — traveler signs there only.\n\n' +
      'Section 2 · Visa reimbursement\n' +
      '• Only reimburse with an original receipt, up to $250 USD maximum.\n' +
      '• Write the exact amount in local currency and the exchange rate used.\n' +
      '• Calculate and record the USD equivalent.\n' +
      '• If the reimbursement exceeds the maximum allowance, obtain IPS approval BEFORE paying.\n' +
      '• Do NOT write in this section if no receipt is provided.\n\n' +
      'Section 3 · Ground transportation\n' +
      '• Reimburse home-city airport transfers only, with receipt, up to $60 USD maximum.\n' +
      '• Same rules as Visa: exact local amount, exchange rate, USD equivalent.\n' +
      '• IPS approval required if reimbursement exceeds the cap.\n\n' +
      '— COLOUR CODING —\n' +
      '• GREEN fields → traveler fills in and signs only.\n' +
      '• BLUE fields → LEM (you) fills in amounts and signs.\n' +
      '• APPROVAL BOX → IPS only — do not touch unless IPS is present.\n\n' +
      '— SIGNATURE RULES —\n' +
      '• Only sign a section if the corresponding amount is actually being paid to the traveler.\n' +
      '• "Distributed by LEM" line: sign and date after handing over the funds.\n' +
      '• "Received by traveler" line: traveler signs and dates upon receipt.\n\n' +
      '— CHECKLIST —\n' +
      '1. Print one form per traveler before the event.\n' +
      '2. Pre-fill event name, traveler name, and M&IE calculation.\n' +
      '3. Collect receipts for visa and transport before the distribution session.\n' +
      '4. Obtain IPS approval for any overages before the session.\n' +
      '5. Disburse funds, have traveler sign, then sign as LEM.\n' +
      '6. Photograph or scan all completed forms and upload to this task.\n' +
      '7. Submit originals to PSA per the SOW instructions.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 13,
    active: 'yes',
    dueOffsetDays: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-transfer',
    title: 'Airport transfer list — {{event_code}} {{city}}',
    category: 'Transportation',
    instructions:
      'Generate the airport ↔ hotel transfer list for {{event_name}} in {{city}} ({{dates}}).\n\n' +
      '📋 USE THE TRANSFER LIST GENERATOR TOOL:\n' +
      '→ /transfer-list?code={{event_code}}&city={{city}}&dates={{dates}}\n\n' +
      '— HOW TO USE THE GENERATOR —\n\n' +
      '1. Open the link above (pre-filled with event details).\n' +
      '2. Enter the hotel name and airport name(s).\n' +
      '   • If arrivals and departures use different airports, fill both fields.\n' +
      '3. Add each traveler and complete all fields:\n' +
      '   ARRIVALS  → name, phone, type (Expert/Participant), arrival date, flight code, arrival time\n' +
      '   DEPARTURES → departure date, flight code, departure time, hotel pick-up time\n' +
      '   (Departure fields auto-fill the traveler\'s name, phone and type from the arrivals data)\n' +
      '4. Travelers on the same flight are automatically grouped together.\n' +
      '5. Vehicle type is assigned automatically per group:\n' +
      '   1–2 pax → SEDAN   ·   3–7 → VAN   ·   8–14 → SPRINTER\n' +
      '   15–24 → MINIBUS   ·   25–45 → BUS\n' +
      '6. The dark blue separator line appears between each flight group.\n' +
      '7. Click "Export Excel (.xlsx)" — the file is named automatically:\n' +
      '   {code}_{city}_{dates}_Transfer_List.xlsx\n\n' +
      '— CHECKLIST —\n' +
      '1. Collect all arrival/departure flight details from the SOW or traveler confirmations.\n' +
      '2. Confirm hotel name and airport names with the venue team.\n' +
      '3. Generate the list 5–7 days before the event.\n' +
      '4. Share with the transportation vendor and upload the final xlsx to this task.\n' +
      '5. Update the list if any flight details change.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 4,
    active: 'yes',
    dueOffsetDays: -7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-per-diem-form',
    title: 'Generate per diem forms — {{event_name}}',
    category: 'Finance',
    instructions:
      'Generate and print event-specific per diem cash disbursement forms for {{event_name}} in {{city}} ({{dates}}).\n\n' +
      '📋 USE THE FORM GENERATOR TOOL:\n' +
      '→ /per-diem-form?event={{event_code}}&location={{city}}&dates={{dates}}\n\n' +
      '— CONFIGURABLE AMOUNTS FOR THIS EVENT —\n\n' +
      'Enter the following amounts when you open the generator:\n\n' +
      '1. M&IE daily rate (USD): ${{per_diem_daily_rate}}\n' +
      '   → Total = rate × number of travel days per traveler\n\n' +
      '2. Maximum Visa reimbursement (USD): ${{max_visa_allowance}}\n' +
      '   → Reimburse only with original receipt, up to this cap.\n' +
      '   → If the actual receipt amount exceeds the cap, obtain IPS approval BEFORE paying.\n\n' +
      '3. Maximum ground transportation (USD): ${{max_ground_transport}}\n' +
      '   → Home-city airport transfers only, with receipt, up to this cap.\n' +
      '   → IPS approval required for any overage.\n\n' +
      '— STEPS —\n' +
      '1. Open the form generator (link above), enter the three amounts for this event.\n' +
      '2. Enter the traveler\'s name and event details.\n' +
      '3. Click "Generate form", then "Print / Save as PDF".\n' +
      '4. Repeat for every traveler expected to receive per diem.\n' +
      '5. Bring printed forms on-site, collect signatures, disburse funds.\n' +
      '6. Scan completed forms and upload them to this task.\n\n' +
      '— COLOUR CODING REMINDER —\n' +
      '• GREEN → traveler fills in and signs only.\n' +
      '• BLUE → LEM fills in amounts and signs.\n' +
      '• APPROVAL BOX → IPS only.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 14,
    active: 'yes',
    dueOffsetDays: -3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
  {
    templateId: 'tpl-av-equipment',
    title: 'AV equipment list — {{event_code}} {{city}}',
    category: 'AV',
    instructions:
      'Generate the conference AV equipment list for {{event_name}} in {{city}} ({{dates}}).\n\n' +
      '🎛️ USE THE AV EQUIPMENT LIST GENERATOR TOOL:\n' +
      '→ /av-equipment\n\n' +
      '— HOW TO USE THE GENERATOR —\n\n' +
      '1. Open the link above and select this event from the event dropdown.\n' +
      '2. Choose the setup style (Classroom / Cabaret / Theatre / U-Shape / Boardroom).\n' +
      '3. Enter the number of PAX and the number of days AV is needed.\n' +
      '4. Check each equipment item required for the event and configure its options:\n' +
      '   • LCD projector  → choose luminosity (3000–8000 lm) and quantity\n' +
      '   • Projector screen → choose size and quantity\n' +
      '   • Laptop → quantity (1–15)\n' +
      '   • Fixed tabletop mics → number of mics (10–150)\n' +
      '   • Head table mics → number (1–10)\n' +
      '   • Wireless/lapel mics → lapel count (1–4) + handheld count (1–10)\n' +
      '   • Simultaneous Interpretation → receivers (5–200) and booths (1–5)\n' +
      '5. Review the live preview on the right to confirm descriptions and quantities.\n' +
      '6. Click "Export Equipment List (.xlsx)" — the file is named automatically:\n' +
      '   {code}_{city}_{date}_Equipment.xlsx\n\n' +
      '— CHECKLIST —\n' +
      '1. Confirm setup style and PAX count with the venue team.\n' +
      '2. Verify interpretation language requirements and booth/receiver counts.\n' +
      '3. Send the exported list to the AV vendor for quotation.\n' +
      '4. Upload the vendor-confirmed list to this task once pricing is agreed.',
    defaultAssigneeEmail: '',
    defaultAssigneeName: '',
    sortOrder: 5,
    active: 'yes',
    dueOffsetDays: -14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
  },
];

const templateFiles: Record<string, TemplateFile[]> = {
  'tpl-sow': [
    {
      fileId: 'tf-sow-1',
      templateId: 'tpl-sow',
      fileName: 'SOW-checklist.pdf',
      mimeType: 'application/pdf',
      driveFileId: '',
      driveUrl: '#',
      sizeBytes: 245000,
      uploadedAt: new Date().toISOString(),
    },
  ],
  'tpl-av': [
    {
      fileId: 'tf-av-1',
      templateId: 'tpl-av',
      fileName: 'AV-requirements.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      driveFileId: '',
      driveUrl: '#',
      sizeBytes: 52000,
      uploadedAt: new Date().toISOString(),
    },
  ],
  'tpl-per-diem': [
    {
      fileId: 'tf-per-diem-1',
      templateId: 'tpl-per-diem',
      fileName: 'Per diem distribution.pdf',
      mimeType: 'application/pdf',
      driveFileId: '',
      driveUrl: '/Per diem distribution.pdf',
      sizeBytes: 63000,
      uploadedAt: new Date().toISOString(),
    },
  ],
  'tpl-per-diem-form': [
    {
      fileId: 'tf-per-diem-form-1',
      templateId: 'tpl-per-diem-form',
      fileName: 'Per diem distribution.pdf',
      mimeType: 'application/pdf',
      driveFileId: '',
      driveUrl: '/Per diem distribution.pdf',
      sizeBytes: 63000,
      uploadedAt: new Date().toISOString(),
    },
  ],
};

export function listMockTemplatesWithFiles(): TaskTemplateWithFiles[] {
  return templates
    .filter((t) => t.active === 'yes')
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    .map((template) => ({
      template,
      files: templateFiles[template.templateId] || [],
    }));
}

export function listMockTemplates(): TaskTemplate[] {
  return templates.filter((t) => t.active === 'yes');
}

export function getMockTemplate(templateId: string): TaskTemplateWithFiles | null {
  const template = templates.find((t) => t.templateId === templateId);
  if (!template) return null;
  return { template, files: templateFiles[templateId] || [] };
}

export function createMockTemplate(payload: Partial<TaskTemplate>): TaskTemplate {
  const t: TaskTemplate = {
    templateId: 'tpl-' + Date.now(),
    title: payload.title || 'New template',
    category: payload.category || 'General',
    instructions: payload.instructions || '',
    defaultAssigneeEmail: payload.defaultAssigneeEmail || '',
    defaultAssigneeName: payload.defaultAssigneeName || '',
    sortOrder: payload.sortOrder ?? 99,
    active: 'yes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: payload.createdBy || '',
  };
  templates.push(t);
  templateFiles[t.templateId] = [];
  return t;
}

export function updateMockTemplate(
  templateId: string,
  updates: Partial<TaskTemplate>,
): TaskTemplate {
  const idx = templates.findIndex((t) => t.templateId === templateId);
  if (idx < 0) throw new Error('Template not found');
  templates[idx] = {
    ...templates[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return templates[idx];
}

export function deleteMockTemplate(templateId: string): void {
  updateMockTemplate(templateId, { active: 'no' });
}

export function addMockTemplateFile(templateId: string, file: File): TemplateFile {
  const f: TemplateFile = {
    fileId: 'tf-' + Date.now(),
    templateId,
    fileName: file.name,
    mimeType: file.type,
    driveFileId: '',
    driveUrl: URL.createObjectURL(file),
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
  };
  if (!templateFiles[templateId]) templateFiles[templateId] = [];
  templateFiles[templateId].push(f);
  return f;
}

export interface VendorLinkInput {
  vendorCategory?: string;
  vendorName?: string;
  label?: string;
  permission?: 'view' | 'collaborate';
}

export function getOrCreateMockVendorLink(
  eventCode: string,
  eventRowId: string,
  input?: VendorLinkInput,
): VendorLink {
  const category = input?.vendorCategory || '';
  const existing = getVendorLinksForEvent(eventCode).find(
    (l) => (l.vendorCategory || '') === category,
  );
  if (existing) return existing;

  const link: VendorLink = {
    linkId: 'vl-' + eventCode + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    token: generateVendorToken(),
    eventCode,
    eventRowId,
    label:
      input?.label ||
      (input?.vendorName
        ? `${input.vendorName} portal`
        : category
          ? `${category} portal`
          : 'Vendor portal'),
    vendorCategory: category || undefined,
    vendorName: input?.vendorName,
    permission: input?.permission || 'view',
    createdAt: new Date().toISOString(),
    createdBy: '',
    active: 'yes',
  };
  setVendorLink(link);
  return link;
}

export function regenerateMockVendorLink(
  eventCode: string,
  eventRowId: string,
  input?: VendorLinkInput,
): VendorLink {
  const category = input?.vendorCategory || '';
  getVendorLinksForEvent(eventCode)
    .filter((l) => (l.vendorCategory || '') === category)
    .forEach((l) => deactivateVendorLink(l.linkId));
  return getOrCreateMockVendorLink(eventCode, eventRowId, input);
}

export function listMockVendorLinks(eventCode: string): VendorLink[] {
  return getVendorLinksForEvent(eventCode);
}

export function revokeMockVendorLink(linkId: string): void {
  deactivateVendorLink(linkId);
}

export function getMockVendorLink(eventCode: string): VendorLink | null {
  return getVendorLinkByEvent(eventCode);
}
