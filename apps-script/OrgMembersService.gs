/**
 * OrgMembersService — persists org members and the role-capability matrix
 * in dedicated sheets.
 *
 * OrgMembers sheet columns: id | name | email | role | status | createdAt | invitedBy
 * RoleCapabilities sheet  : single data row, column A holds the JSON blob.
 */

var ORG_MEMBERS_SHEET_  = 'OrgMembers';
var ROLE_CAPS_SHEET_    = 'RoleCapabilities';
var ORG_MEMBER_COLS_    = ['id', 'name', 'email', 'role', 'status', 'createdAt', 'invitedBy'];

// ── Sheet access ──────────────────────────────────────────────────────────

function getOrgMembersSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ORG_MEMBERS_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(ORG_MEMBERS_SHEET_);
    sheet.appendRow(ORG_MEMBER_COLS_);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getRoleCapabilitiesSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ROLE_CAPS_SHEET_);
  if (!sheet) {
    sheet = ss.insertSheet(ROLE_CAPS_SHEET_);
    sheet.appendRow(['matrix']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Members helpers ───────────────────────────────────────────────────────

function listMembers_() {
  var sheet   = getOrgMembersSheet_();
  var data    = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = String(row[i] != null ? row[i] : ''); });
    return obj;
  });
}

function findMemberRow_(id) {
  var sheet   = getOrgMembersSheet_();
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol   = headers.indexOf('id');
  if (idCol < 0) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id) {
      return { rowIndex: i + 1, headers: headers };
    }
  }
  return null;
}

// ── Members public API ────────────────────────────────────────────────────

function upsertMember_(member) {
  var row = [
    member.id,
    member.name,
    (member.email || '').toLowerCase().trim(),
    member.role,
    member.status,
    member.createdAt || new Date().toISOString().slice(0, 10),
    member.invitedBy || '',
  ];

  var found = findMemberRow_(member.id);
  if (found) {
    getOrgMembersSheet_()
      .getRange(found.rowIndex, 1, 1, row.length)
      .setValues([row]);
  } else {
    getOrgMembersSheet_().appendRow(row);
  }
  return member;
}

function deactivateMember_(id) {
  var found = findMemberRow_(id);
  if (!found) throw new Error('Member not found: ' + id);
  // status is the 5th column (index 4, 1-based = 5)
  var statusColIndex = found.headers.indexOf('status') + 1;
  getOrgMembersSheet_()
    .getRange(found.rowIndex, statusColIndex)
    .setValue('inactive');
}

// ── Capability matrix ─────────────────────────────────────────────────────

function getCapMatrixFromSheet_() {
  var sheet = getRoleCapabilitiesSheet_();
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var json = String(data[1][0] || '').trim();
  if (!json) return null;
  try { return JSON.parse(json); } catch (e) { return null; }
}

function saveCapMatrixToSheet_(matrix) {
  var sheet = getRoleCapabilitiesSheet_();
  var json  = JSON.stringify(matrix);
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([json]);
  } else {
    sheet.getRange(2, 1).setValue(json);
  }
}
