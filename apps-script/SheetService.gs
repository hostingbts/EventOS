/**
 * Creates the Drive folder structure for a new event (used by createEvent_).
 * Full file-upload helpers live in FilesService.gs when that file is deployed.
 */
var ACTIVITY_LOG_COLS_ = {
  ACTIVITY_ID: 'Activity ID',
  TYPE: 'Type',
  EVENT_CODE: 'Event Code',
  TASK_ID: 'Task ID',
  SUMMARY: 'Summary',
  ACTOR: 'Actor',
  CREATED_AT: 'Created At',
};

function getActivityLogSheet_() {
  var ss = getSpreadsheet_();
  var name = CONFIG.ACTIVITY_SHEET;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow([
      ACTIVITY_LOG_COLS_.ACTIVITY_ID,
      ACTIVITY_LOG_COLS_.TYPE,
      ACTIVITY_LOG_COLS_.EVENT_CODE,
      ACTIVITY_LOG_COLS_.TASK_ID,
      ACTIVITY_LOG_COLS_.SUMMARY,
      ACTIVITY_LOG_COLS_.ACTOR,
      ACTIVITY_LOG_COLS_.CREATED_AT,
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Append one row to the Activity sheet (full feed in ActivityService.gs). */
function logActivity_(type, eventCode, taskId, summary, actor) {
  try {
    var sheet = getActivityLogSheet_();
    var map = getHeaderMap_(sheet);
    var row = sheet.getLastRow() + 1;
    var now = new Date().toISOString();

    function setCol(name, val) {
      var c = colIndex_(map, name);
      if (c) sheet.getRange(row, c).setValue(val);
    }

    setCol(ACTIVITY_LOG_COLS_.ACTIVITY_ID, Utilities.getUuid());
    setCol(ACTIVITY_LOG_COLS_.TYPE, type);
    setCol(ACTIVITY_LOG_COLS_.EVENT_CODE, eventCode || '');
    setCol(ACTIVITY_LOG_COLS_.TASK_ID, taskId || '');
    setCol(ACTIVITY_LOG_COLS_.SUMMARY, summary || '');
    setCol(ACTIVITY_LOG_COLS_.ACTOR, actor || '');
    setCol(ACTIVITY_LOG_COLS_.CREATED_AT, now);
  } catch (e) {
    Logger.log('logActivity_ skipped: ' + e);
  }
}

function createEventDriveFolders_(eventCode, location) {
  try {
    var folderId = getScriptProperty_('DRIVE_ROOT_FOLDER_ID', true) || DEFAULT_DRIVE_ROOT_FOLDER_ID;
    var root = DriveApp.getFolderById(folderId);
    var folderName = location ? (eventCode + ' - ' + location) : eventCode;
    var iter = root.getFoldersByName(folderName);
    if (iter.hasNext()) return iter.next().getUrl();
    var iterCode = root.getFoldersByName(eventCode);
    if (iterCode.hasNext()) return iterCode.next().getUrl();
    var eventFolder = root.createFolder(folderName);
    setOrgSharing_(eventFolder);
    EVENT_SUBFOLDERS.forEach(function (name) {
      var sub = eventFolder.createFolder(name);
      setOrgSharing_(sub);
    });
    return eventFolder.getUrl();
  } catch (e) {
    Logger.log('createEventDriveFolders_ error: ' + e);
    return '';
  }
}

function getEventsSheet_() {
  var name = getScriptProperty_('SHEET_NAME', true) || CONFIG.SHEET_NAME;
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = [
      CONFIG.COLS.CODE,
      CONFIG.COLS.LOCATION,
      CONFIG.COLS.DATES,
      CONFIG.COLS.LEM,
      CONFIG.COLS.AV,
      CONFIG.COLS.INTERPRETERS,
      CONFIG.COLS.VENUE,
      CONFIG.COLS.PSA_CLDP,
      CONFIG.COLS.SOW,
      CONFIG.COLS.NOTES,
      CONFIG.COLS.MONTH_GROUP,
      CONFIG.COLS.START_DATE,
      CONFIG.COLS.END_DATE,
      CONFIG.COLS.OWNER_EMAIL,
      CONFIG.COLS.LAST_REMINDER,
      CONFIG.COLS.ROW_ID,
      CONFIG.COLS.DRIVE_FOLDER_URL,
    ];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim();
    if (h) map[h] = i + 1;
  }
  return map;
}

function colIndex_(map, colName) {
  var idx = map[colName];
  if (!idx) return null;
  return idx;
}

function rowToEvent_(row, rowNum, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }

  var code = cell(CONFIG.COLS.CODE);
  if (!code || code === 'Code') return null;

  // Skip month separator rows (no code, or month header pattern)
  if (/^\s*$/.test(code)) return null;

  return {
    rowNumber: rowNum,
    rowId: cell(CONFIG.COLS.ROW_ID) || 'row-' + rowNum,
    code: code,
    location: cell(CONFIG.COLS.LOCATION),
    dates: cell(CONFIG.COLS.DATES),
    lem: cell(CONFIG.COLS.LEM),
    av: cell(CONFIG.COLS.AV),
    interpreters: cell(CONFIG.COLS.INTERPRETERS),
    venue: cell(CONFIG.COLS.VENUE),
    psaCldp: cell(CONFIG.COLS.PSA_CLDP),
    sow: cell(CONFIG.COLS.SOW),
    notes: cell(CONFIG.COLS.NOTES),
    monthGroup: cell(CONFIG.COLS.MONTH_GROUP),
    startDate: cell(CONFIG.COLS.START_DATE),
    endDate: cell(CONFIG.COLS.END_DATE),
    ownerEmail: cell(CONFIG.COLS.OWNER_EMAIL),
    lastReminder: cell(CONFIG.COLS.LAST_REMINDER),
    driveFolderUrl: cell(CONFIG.COLS.DRIVE_FOLDER_URL),
  };
}

function listEvents_() {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= CONFIG.HEADER_ROW) {
    return { months: [], events: [] };
  }

  var data = sheet.getRange(CONFIG.HEADER_ROW + 1, 1, lastRow - CONFIG.HEADER_ROW, sheet.getLastColumn()).getValues();
  var events = [];
  var currentMonth = '';

  for (var i = 0; i < data.length; i++) {
    var rowNum = CONFIG.HEADER_ROW + 1 + i;
    var row = data[i];
    var mapCols = getHeaderMap_(sheet);

    // Detect month header row: Code empty but first col or Month Group has month label
    var codeCol = colIndex_(mapCols, CONFIG.COLS.CODE);
    var codeVal = codeCol ? String(row[codeCol - 1] || '').trim() : '';
    var monthCol = colIndex_(mapCols, CONFIG.COLS.MONTH_GROUP);
    var monthVal = monthCol ? String(row[monthCol - 1] || '').trim() : '';

    if (!codeVal && monthVal) {
      currentMonth = monthVal;
      continue;
    }

    // Month separator in column A style (only location/month text in row)
    if (!codeVal && !monthVal) {
      var firstCell = String(row[0] || '').trim();
      if (firstCell && /20\d{2}/.test(firstCell)) {
        currentMonth = firstCell;
        continue;
      }
    }

    var ev = rowToEvent_(row, rowNum, mapCols);
    if (!ev) continue;

    if (!ev.monthGroup && currentMonth) {
      ev.monthGroup = currentMonth;
    }
    events.push(ev);
  }

  var monthSet = {};
  events.forEach(function (e) {
    if (e.monthGroup) monthSet[e.monthGroup] = true;
  });
  var months = Object.keys(monthSet).sort();

  return { months: months, events: events };
}

function findEventRow_(rowId, code) {
  var result = listEvents_();
  for (var i = 0; i < result.events.length; i++) {
    var e = result.events[i];
    if (rowId && e.rowId === rowId) return e;
    if (code && e.code === code) return e;
  }
  return null;
}

function updateEventFields_(rowNumber, updates) {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var fieldMap = {
    lem: CONFIG.COLS.LEM,
    av: CONFIG.COLS.AV,
    interpreters: CONFIG.COLS.INTERPRETERS,
    venue: CONFIG.COLS.VENUE,
    psaCldp: CONFIG.COLS.PSA_CLDP,
    sow: CONFIG.COLS.SOW,
    notes: CONFIG.COLS.NOTES,
    ownerEmail: CONFIG.COLS.OWNER_EMAIL,
    startDate: CONFIG.COLS.START_DATE,
    endDate: CONFIG.COLS.END_DATE,
    driveFolderUrl: CONFIG.COLS.DRIVE_FOLDER_URL,
  };

  Object.keys(updates).forEach(function (key) {
    var colName = fieldMap[key];
    if (!colName) return;
    var col = colIndex_(map, colName);
    if (!col) return;
    sheet.getRange(rowNumber, col).setValue(updates[key]);
  });

  var refreshed = listEvents_().events.filter(function (e) {
    return e.rowNumber === rowNumber;
  })[0];
  return refreshed || null;
}

function createEvent_(payload) {
  if (!payload || !payload.code) {
    throw new Error('Event code required');
  }
  if (findEventRow_(null, payload.code)) {
    throw new Error('An event with code "' + payload.code + '" already exists');
  }

  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var rowId = Utilities.getUuid();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c && val !== undefined && val !== null && val !== '') {
      sheet.getRange(row, c).setValue(val);
    }
  }

  setCol(CONFIG.COLS.CODE, payload.code);
  setCol(CONFIG.COLS.LOCATION, payload.location || '');
  setCol(CONFIG.COLS.DATES, payload.dates || '');
  setCol(CONFIG.COLS.LEM, payload.lem || 'Open');
  setCol(CONFIG.COLS.AV, payload.av || '');
  setCol(CONFIG.COLS.INTERPRETERS, payload.interpreters || '');
  setCol(CONFIG.COLS.VENUE, payload.venue || '');
  setCol(CONFIG.COLS.PSA_CLDP, payload.psaCldp || '');
  setCol(CONFIG.COLS.SOW, payload.sow || '');
  setCol(CONFIG.COLS.NOTES, payload.notes || '');
  setCol(CONFIG.COLS.MONTH_GROUP, payload.monthGroup || monthGroupFromDate_(payload.startDate));
  setCol(CONFIG.COLS.START_DATE, payload.startDate || '');
  setCol(CONFIG.COLS.END_DATE, payload.endDate || payload.startDate || '');
  setCol(CONFIG.COLS.OWNER_EMAIL, payload.ownerEmail || '');
  setCol(CONFIG.COLS.ROW_ID, rowId);

  // Create Google Drive folder structure for this event
  var driveFolderUrl = createEventDriveFolders_(payload.code, payload.location || '');
  if (driveFolderUrl) {
    setCol(CONFIG.COLS.DRIVE_FOLDER_URL, driveFolderUrl);
  }

  logActivity_('event_created', payload.code, '', payload.location || '', payload.createdBy || '');

  var templateIds = payload.templateIds || [];
  var createdTasks = [];
  if (templateIds.length) {
    if (typeof applyTemplatesToEvent_ !== 'function') {
      throw new Error(
        'Task templates need TemplatesService.gs and TasksService.gs in this Apps Script project. ' +
        'Copy them from the repo (or clasp push), redeploy, or create the event without selecting templates.'
      );
    }
    var applied = applyTemplatesToEvent_(payload.code, rowId, templateIds, payload.createdBy || '');
    createdTasks = applied.tasks || [];
  } else if (typeof seedDefaultTasks_ === 'function') {
    seedDefaultTasks_(payload.code, rowId);
  }

  return {
    event: findEventRow_(rowId, payload.code),
    tasks: createdTasks,
  };
}

function deleteEvent_(rowId, code, actorEmail) {
  requireAdmin_(actorEmail);
  var ev = findEventRow_(rowId, code);
  if (!ev) throw new Error('Event not found');

  deleteTasksForEvent_(ev.code);

  var sheet = getEventsSheet_();
  sheet.deleteRow(ev.rowNumber);
  logActivity_('event_deleted', ev.code, '', ev.location || '', actorEmail || '');
  return { ok: true, code: ev.code };
}

function monthGroupFromDate_(startDate) {
  var d = parseDate_(startDate);
  if (!d) return '';
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  return months[d.getMonth()] + ' ' + d.getFullYear();
}

function setLastReminder_(rowNumber, value) {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var col = colIndex_(map, CONFIG.COLS.LAST_REMINDER);
  if (col) {
    sheet.getRange(rowNumber, col).setValue(value);
  }
}

function parseDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value;
  }
  var s = String(value).trim();
  if (!s) return null;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function daysUntil_(date) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function isMissingSow_(sow) {
  var s = String(sow || '').trim().toLowerCase();
  return !s || s === '??' || s === 'n/a' || s === '-';
}

function isMissingVenue_(venue) {
  return !String(venue || '').trim();
}

function isLemOpen_(lem) {
  var s = String(lem || '').trim().toLowerCase();
  return s !== 'closed';
}
