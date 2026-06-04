/**
 * Link a Google Form to this sheet, then set trigger: onFormSubmit → onFormSubmitHandler
 *
 * Expected form fields (map names in setupFormMapping):
 *   Event Code, Location, Dates, LEM, AV, Interpreters, VENUE, PSA/CLDP, SOW URL, Notes, Owner Email
 */

function onFormSubmitHandler(e) {
  if (!e || !e.namedValues) return;

  var nv = e.namedValues;
  function val(name) {
    if (!nv[name]) return '';
    return Array.isArray(nv[name]) ? nv[name][0] : nv[name];
  }

  var code = val('Event Code') || val('Code');
  if (!code) return;

  var existing = findEventRow_(null, code);
  var updates = {
    location: val('Location'),
    dates: val('Dates'),
    lem: val('LEM'),
    av: val('AV'),
    interpreters: val('Interpreters'),
    venue: val('VENUE'),
    psaCldp: val('PSA/CLDP'),
    sow: val('SOW URL') || val('SOW'),
    notes: val('Notes'),
    ownerEmail: val('Owner Email'),
    startDate: val('Start Date'),
    endDate: val('End Date'),
  };

  // Remove empty updates
  Object.keys(updates).forEach(function (k) {
    if (updates[k] === '') delete updates[k];
  });

  if (existing) {
    updateEventFields_(existing.rowNumber, updates);
  } else {
    appendEventFromForm_(code, updates);
  }
}

function appendEventFromForm_(code, updates) {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;

  function setCol(name, value) {
    var c = colIndex_(map, name);
    if (c && value !== undefined && value !== '') {
      sheet.getRange(row, c).setValue(value);
    }
  }

  setCol(CONFIG.COLS.CODE, code);
  setCol(CONFIG.COLS.LOCATION, updates.location);
  setCol(CONFIG.COLS.DATES, updates.dates);
  setCol(CONFIG.COLS.LEM, updates.lem || 'Open');
  setCol(CONFIG.COLS.AV, updates.av);
  setCol(CONFIG.COLS.INTERPRETERS, updates.interpreters);
  setCol(CONFIG.COLS.VENUE, updates.venue);
  setCol(CONFIG.COLS.PSA_CLDP, updates.psaCldp);
  setCol(CONFIG.COLS.SOW, updates.sow);
  setCol(CONFIG.COLS.NOTES, updates.notes);
  setCol(CONFIG.COLS.OWNER_EMAIL, updates.ownerEmail);
  setCol(CONFIG.COLS.START_DATE, updates.startDate);
  setCol(CONFIG.COLS.END_DATE, updates.endDate);
  setCol(CONFIG.COLS.ROW_ID, Utilities.getUuid());
}

/** One-time: ensure Row ID on all existing rows */
function backfillRowIds() {
  var sheet = getEventsSheet_();
  var map = getHeaderMap_(sheet);
  var col = colIndex_(map, CONFIG.COLS.ROW_ID);
  if (!col) return;

  var data = listEvents_();
  data.events.forEach(function (ev) {
    if (!ev.rowId || ev.rowId.indexOf('row-') === 0) {
      sheet.getRange(ev.rowNumber, col).setValue(Utilities.getUuid());
    }
  });
}
