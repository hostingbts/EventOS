/**
 * Configuration — set values in Script Properties (Project settings → Script properties)
 *
 * Required:
 *   API_TOKEN          — shared secret for web/iOS app (generate a long random string)
 *
 * Optional:
 *   GEMINI_API_KEY     — for AI digest / draft emails
 *   EVENT_MANAGER_EMAIL — default recipient for digests (falls back to script owner)
 *   SHEET_NAME         — tab name (default: Events)
 */

/**
 * Default Google Drive parent folder for all event folders.
 * This is the folder shared at:
 *   https://drive.google.com/drive/folders/17p0K9TB8rzwOdF_H6PQvGlXOJpYDAVaj
 *
 * You can override this at runtime by setting the Script property
 * DRIVE_ROOT_FOLDER_ID to a different folder ID.
 */
var DEFAULT_DRIVE_ROOT_FOLDER_ID = '17p0K9TB8rzwOdF_H6PQvGlXOJpYDAVaj';

/**
 * Organisation domain — Drive files and folders are shared with this
 * Google Workspace domain only (no public / anyone-with-link access).
 * Can be overridden via the Script property ORG_DOMAIN.
 */
var DEFAULT_ORG_DOMAIN = 'connectmice.com';

/** Subfolders created automatically inside every new event folder. */
var EVENT_SUBFOLDERS = [
  'SOW',
  'AV Equipment',
  'Transfer Lists',
  'Per Diem Forms',
  'Presentations',
  'Evaluation',
  'Templates',
  'Photos',
  'Registration',
  'Reports',
];

var CONFIG = {
  SHEET_NAME: 'Events',
  TASKS_SHEET: 'Tasks',
  COMMENTS_SHEET: 'Comments',
  FILES_SHEET: 'Files',
  ACTIVITY_SHEET: 'Activity',
  TEMPLATES_SHEET: 'Task Templates',
  TEMPLATE_FILES_SHEET: 'Template Files',
  VENDOR_LINKS_SHEET: 'Vendor Links',
  HEADER_ROW: 1,
  MAX_UPLOAD_BYTES: 10485760,

  // Column headers (must match sheet row 1)
  COLS: {
    CODE: 'Code',
    LOCATION: 'Location',
    DATES: 'Dates',
    LEM: 'LEM',
    AV: 'AV',
    INTERPRETERS: 'Interpreters',
    VENUE: 'VENUE',
    PSA_CLDP: 'PSA/CLDP',
    SOW: 'SOW',
    NOTES: 'Notes',
    MONTH_GROUP: 'Month Group',
    START_DATE: 'Start Date',
    END_DATE: 'End Date',
    OWNER_EMAIL: 'Owner Email',
    LAST_REMINDER: 'Last Reminder',
    ROW_ID: 'Row ID',
    DRIVE_FOLDER_URL: 'Drive Folder URL',
  },

  REMINDER_DAYS: [30, 14, 7, 1],
  MISSING_SOW_DAYS: 21,
  MISSING_VENUE_DAYS: 14,
};

function getScriptProperty_(key, optional) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v && !optional) {
    throw new Error('Missing Script property: ' + key);
  }
  return v || '';
}

function getApiToken_() {
  return getScriptProperty_('API_TOKEN');
}

/**
 * Returns the spreadsheet backing this project.
 * Standalone scripts (created at script.google.com) must set SPREADSHEET_ID
 * in Script properties. Sheet-bound scripts can omit it.
 */
function getSpreadsheet_() {
  var id = getScriptProperty_('SPREADSHEET_ID', true);
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'No spreadsheet linked. In Project settings → Script properties, set SPREADSHEET_ID ' +
      'to your Google Sheet ID (from the sheet URL), or bind this project via ' +
      'Extensions → Apps Script inside the spreadsheet.'
    );
  }
  return ss;
}

function getOrgDomain_() {
  return getScriptProperty_('ORG_DOMAIN', true) || DEFAULT_ORG_DOMAIN;
}

/**
 * Restrict a Drive file or folder to connectmice.com viewers only.
 * Falls back gracefully if the domain sharing call fails
 * (e.g. script account is on a different domain).
 */
function setOrgSharing_(item) {
  try {
    // Remove any broader public access first
    item.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    // Grant view access to the org domain
    item.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('setOrgSharing_ failed, falling back to DOMAIN_WITH_LINK: ' + e);
    try {
      item.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e2) {
      Logger.log('setOrgSharing_ fallback also failed: ' + e2);
    }
  }
}

function getGeminiKey_() {
  return getScriptProperty_('GEMINI_API_KEY', true);
}

function getEventManagerEmail_() {
  var em = getScriptProperty_('EVENT_MANAGER_EMAIL', true);
  if (em) return em;
  return Session.getEffectiveUser().getEmail();
}

