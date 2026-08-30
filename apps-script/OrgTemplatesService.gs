/**
 * OrgTemplatesService — the org-wide "Templates" library (print materials,
 * social media assets, forms, branding). Unlike Task Templates (which
 * generate per-event tasks), these are just named file slots any admin can
 * fill in — once uploaded, the file lives in Drive and is visible/downloadable
 * by everyone, instead of being stuck in whichever browser's localStorage
 * the admin happened to upload from.
 *
 * Org Templates sheet columns: ID | Name | Category | File Type |
 *   Drive File ID | Drive URL | Size Bytes | Added By | Added At
 */

var ORG_TEMPLATES_SHEET_ = 'Org Templates';
var ORG_TEMPLATE_COLS_ = {
  ID: 'ID',
  NAME: 'Name',
  CATEGORY: 'Category',
  FILE_TYPE: 'File Type',
  DRIVE_FILE_ID: 'Drive File ID',
  DRIVE_URL: 'Drive URL',
  SIZE_BYTES: 'Size Bytes',
  ADDED_BY: 'Added By',
  ADDED_AT: 'Added At',
};

/** Mirrors web/src/utils/orgTemplatesStore.ts SEED_FILES — pre-named slots
 * admins fill in over time. Only used to seed the sheet the first time. */
var ORG_TEMPLATE_SEED_ = [
  { id: 'otf-cert-holder',     name: 'Certificate Holder – CLDP',    category: 'Print Materials', fileType: 'pdf' },
  { id: 'otf-backdrop1',       name: 'Backdrop 11',                  category: 'Print Materials', fileType: 'pdf' },
  { id: 'otf-backdrop2',       name: 'Backdrop 22',                  category: 'Print Materials', fileType: 'pdf' },
  { id: 'otf-bloknot',         name: 'Bloknot (Notebook)',           category: 'Print Materials', fileType: 'pdf' },
  { id: 'otf-pocket-folder',   name: 'CLDP Pocket Folder',           category: 'Print Materials', fileType: 'pdf' },
  { id: 'otf-notebook-design', name: 'Notebook Design',              category: 'Print Materials', fileType: 'pdf' },
  { id: 'otf-social-qr',       name: 'CLDP Social Media – QR Codes', category: 'Social Media',    fileType: 'docx' },
  { id: 'otf-social-pdf',      name: 'CLDP Social Media',            category: 'Social Media',    fileType: 'pdf' },
  { id: 'otf-per-diem',        name: 'Per Diem Distribution Form',   category: 'Forms',            fileType: 'pdf' },
];

function getOrgTemplatesSheet_() {
  return getOrCreateSheet_(ORG_TEMPLATES_SHEET_, Object.values(ORG_TEMPLATE_COLS_));
}

/** Top-level "Org Templates" folder under the Drive root (not event-scoped). */
function getOrgTemplatesFolder_() {
  var root = getDriveRootFolder_();
  var iter = root.getFoldersByName('Org Templates');
  return iter.hasNext() ? iter.next() : root.createFolder('Org Templates');
}

function seedDefaultOrgTemplates_() {
  var sheet = getOrgTemplatesSheet_();
  var now = new Date().toISOString();
  var rows = ORG_TEMPLATE_SEED_.map(function (t) {
    return [t.id, t.name, t.category, t.fileType, '', '', '', 'system', now];
  });
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function rowToOrgTemplate_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }
  var id = cell(ORG_TEMPLATE_COLS_.ID);
  if (!id) return null;
  return {
    id: id,
    name: cell(ORG_TEMPLATE_COLS_.NAME),
    category: cell(ORG_TEMPLATE_COLS_.CATEGORY),
    fileType: cell(ORG_TEMPLATE_COLS_.FILE_TYPE) || 'other',
    driveFileId: cell(ORG_TEMPLATE_COLS_.DRIVE_FILE_ID),
    driveUrl: cell(ORG_TEMPLATE_COLS_.DRIVE_URL),
    sizeBytes: Number(cell(ORG_TEMPLATE_COLS_.SIZE_BYTES)) || 0,
    addedBy: cell(ORG_TEMPLATE_COLS_.ADDED_BY),
    addedAt: cell(ORG_TEMPLATE_COLS_.ADDED_AT),
  };
}

function listOrgTemplates_() {
  var sheet = getOrgTemplatesSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    seedDefaultOrgTemplates_();
    return listOrgTemplates_();
  }
  var map = getHeaderMap_(sheet);
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var templates = [];
  var seenIds = {};
  for (var i = 0; i < data.length; i++) {
    var t = rowToOrgTemplate_(data[i], map);
    if (t) {
      templates.push(t);
      seenIds[t.id] = true;
    }
  }

  // The 9 named starter slots (Certificate Holder, Backdrop, etc.) are the
  // library's standing scaffold, not arbitrary uploads — if one was removed
  // (e.g. a stray "Remove from library" click), silently restore it as an
  // empty "not uploaded yet" slot rather than letting the category vanish.
  var missing = ORG_TEMPLATE_SEED_.filter(function (s) { return !seenIds[s.id]; });
  if (missing.length) {
    var now = new Date().toISOString();
    missing.forEach(function (s) {
      sheet.appendRow([s.id, s.name, s.category, s.fileType, '', '', '', 'system', now]);
      templates.push({
        id: s.id, name: s.name, category: s.category, fileType: s.fileType,
        driveFileId: '', driveUrl: '', sizeBytes: 0, addedBy: 'system', addedAt: now,
      });
    });
  }

  return templates;
}

/** Find the sheet row number for a given template ID (2-indexed row), or 0. */
function findOrgTemplateRow_(sheet, map, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  var idCol = colIndex_(map, ORG_TEMPLATE_COLS_.ID);
  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

/**
 * Create a brand-new template slot, or attach/replace the file on an
 * existing one when payload.id matches a row. Admin-only (checked by caller).
 */
function upsertOrgTemplateFile_(payload) {
  if (!payload.fileName || !payload.dataBase64) {
    throw new Error('fileName and dataBase64 required');
  }
  var bytes = Utilities.base64Decode(payload.dataBase64);
  if (bytes.length > CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds 10 MB limit');
  }

  var sheet = getOrgTemplatesSheet_();
  var map = getHeaderMap_(sheet);
  var rowNum = payload.id ? findOrgTemplateRow_(sheet, map, payload.id) : 0;

  var ext = String(payload.fileName).split('.').pop().toLowerCase();
  var fileType =
    ext === 'pdf' ? 'pdf'
    : (ext === 'docx' || ext === 'doc') ? 'docx'
    : (ext === 'xlsx' || ext === 'xls') ? 'xlsx'
    : 'other';

  var folder = getOrgTemplatesFolder_();
  var mimeType = payload.mimeType || 'application/octet-stream';
  var blob = Utilities.newBlob(bytes, mimeType, payload.fileName);

  var driveFileId, driveUrl;
  var existingFileId = rowNum ? String(sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.DRIVE_FILE_ID)).getValue() || '') : '';

  if (existingFileId) {
    var updated = updateDriveFileContent_(existingFileId, blob, payload.fileName);
    driveFileId = updated.getId();
  } else {
    var driveFile = folder.createFile(blob);
    setOrgSharing_(driveFile);
    driveFileId = driveFile.getId();
  }
  driveUrl = 'https://drive.google.com/file/d/' + driveFileId + '/view?usp=sharing';

  var now = new Date().toISOString();

  if (rowNum) {
    if (payload.name) sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.NAME)).setValue(payload.name);
    if (payload.category) sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.CATEGORY)).setValue(payload.category);
    sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.FILE_TYPE)).setValue(fileType);
    sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.DRIVE_FILE_ID)).setValue(driveFileId);
    sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.DRIVE_URL)).setValue(driveUrl);
    sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.SIZE_BYTES)).setValue(bytes.length);
    sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.ADDED_BY)).setValue(payload.actorEmail || '');
    sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.ADDED_AT)).setValue(now);
  } else {
    if (!payload.name || !payload.category) {
      throw new Error('name and category required for a new template');
    }
    var id = 'otf-' + Utilities.getUuid().slice(0, 8);
    sheet.appendRow([
      id, payload.name, payload.category, fileType,
      driveFileId, driveUrl, bytes.length, payload.actorEmail || '', now,
    ]);
    rowNum = sheet.getLastRow();
  }

  logActivity_('org_template_uploaded', '', '', payload.name || '', payload.actorEmail || '');

  map = getHeaderMap_(sheet);
  return rowToOrgTemplate_(sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0], map);
}

function deleteOrgTemplateEntry_(id, actorEmail) {
  var sheet = getOrgTemplatesSheet_();
  var map = getHeaderMap_(sheet);
  var rowNum = findOrgTemplateRow_(sheet, map, id);
  if (!rowNum) throw new Error('Not found');

  var fileId = String(sheet.getRange(rowNum, colIndex_(map, ORG_TEMPLATE_COLS_.DRIVE_FILE_ID)).getValue() || '');
  if (fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (e) {
      Logger.log('deleteOrgTemplateEntry_ trash failed: ' + e);
    }
  }
  sheet.deleteRow(rowNum);
  logActivity_('org_template_deleted', '', '', id, actorEmail || '');
  return { ok: true };
}
