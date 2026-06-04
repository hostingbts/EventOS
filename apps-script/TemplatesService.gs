var TEMPLATE_COLS = {
  TEMPLATE_ID: 'Template ID',
  TITLE: 'Title',
  CATEGORY: 'Category',
  INSTRUCTIONS: 'Instructions',
  DEFAULT_ASSIGNEE_EMAIL: 'Default Assignee Email',
  DEFAULT_ASSIGNEE_NAME: 'Default Assignee Name',
  SORT_ORDER: 'Sort Order',
  ACTIVE: 'Active',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',
  CREATED_BY: 'Created By',
};

var TEMPLATE_FILE_COLS = {
  FILE_ID: 'File ID',
  TEMPLATE_ID: 'Template ID',
  FILE_NAME: 'File Name',
  MIME_TYPE: 'MIME Type',
  DRIVE_FILE_ID: 'Drive File ID',
  DRIVE_URL: 'Drive URL',
  SIZE_BYTES: 'Size Bytes',
  UPLOADED_AT: 'Uploaded At',
};

function getTemplatesSheet_() {
  return getOrCreateSheet_(CONFIG.TEMPLATES_SHEET, Object.values(TEMPLATE_COLS));
}

function getTemplateFilesSheet_() {
  return getOrCreateSheet_(CONFIG.TEMPLATE_FILES_SHEET, Object.values(TEMPLATE_FILE_COLS));
}

function getTemplateFolder_(templateId) {
  var root = getDriveRootFolder_();
  var templatesRoot = root.getFoldersByName('Templates');
  var templatesFolder = templatesRoot.hasNext() ? templatesRoot.next() : root.createFolder('Templates');
  var iter = templatesFolder.getFoldersByName(templateId);
  return iter.hasNext() ? iter.next() : templatesFolder.createFolder(templateId);
}

function listTemplates_(activeOnly) {
  var sheet = getTemplatesSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    seedDefaultTemplates_();
    return listTemplates_(activeOnly);
  }

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var templates = [];
  for (var i = 0; i < data.length; i++) {
    var t = rowToTemplate_(data[i], map);
    if (!t) continue;
    if (activeOnly && String(t.active).toLowerCase() !== 'yes') continue;
    templates.push(t);
  }
  templates.sort(function (a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  return templates;
}

function rowToTemplate_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }
  var id = cell(TEMPLATE_COLS.TEMPLATE_ID);
  if (!id) return null;
  return {
    templateId: id,
    title: cell(TEMPLATE_COLS.TITLE),
    category: cell(TEMPLATE_COLS.CATEGORY),
    instructions: cell(TEMPLATE_COLS.INSTRUCTIONS),
    defaultAssigneeEmail: cell(TEMPLATE_COLS.DEFAULT_ASSIGNEE_EMAIL),
    defaultAssigneeName: cell(TEMPLATE_COLS.DEFAULT_ASSIGNEE_NAME),
    sortOrder: cell(TEMPLATE_COLS.SORT_ORDER),
    active: cell(TEMPLATE_COLS.ACTIVE) || 'yes',
    createdAt: cell(TEMPLATE_COLS.CREATED_AT),
    updatedAt: cell(TEMPLATE_COLS.UPDATED_AT),
    createdBy: cell(TEMPLATE_COLS.CREATED_BY),
  };
}

function findTemplate_(templateId) {
  var all = listTemplates_(false);
  for (var i = 0; i < all.length; i++) {
    if (all[i].templateId === templateId) return all[i];
  }
  return null;
}

function seedDefaultTemplates_() {
  var defaults = [
    {
      title: 'LEM coordination',
      category: 'LEM',
      instructions: 'Confirm LEM scope, vendor, and deadlines. Upload signed SOW when available.',
      sortOrder: 1,
    },
    {
      title: 'AV & technical setup',
      category: 'AV',
      instructions: 'Book AV vendor, confirm room layout, mics, recording, and rehearsal time.',
      sortOrder: 2,
    },
    {
      title: 'Interpreters booking',
      category: 'Interpreters',
      instructions: 'Confirm languages, booth requirements, and interpreter schedule.',
      sortOrder: 3,
    },
    {
      title: 'Venue confirmation',
      category: 'Venue',
      instructions: 'Secure venue contract, capacity, access times, and floor plan.',
      sortOrder: 4,
    },
    {
      title: 'SOW / contract',
      category: 'SOW',
      instructions: 'Prepare, route, and archive statement of work and amendments.',
      sortOrder: 5,
    },
    {
      title: 'Catering',
      category: 'Catering',
      instructions: 'Confirm headcount, dietary needs, service times, and vendor quote.',
      sortOrder: 6,
    },
  ];
  defaults.forEach(function (d) {
    createTemplate_({
      title: d.title,
      category: d.category,
      instructions: d.instructions,
      sortOrder: d.sortOrder,
      createdBy: 'system',
    });
  });
}

function createTemplate_(payload) {
  var sheet = getTemplatesSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var now = new Date().toISOString();
  var templateId = Utilities.getUuid();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(TEMPLATE_COLS.TEMPLATE_ID, templateId);
  setCol(TEMPLATE_COLS.TITLE, payload.title);
  setCol(TEMPLATE_COLS.CATEGORY, payload.category || 'General');
  setCol(TEMPLATE_COLS.INSTRUCTIONS, payload.instructions || '');
  setCol(TEMPLATE_COLS.DEFAULT_ASSIGNEE_EMAIL, payload.defaultAssigneeEmail || '');
  setCol(TEMPLATE_COLS.DEFAULT_ASSIGNEE_NAME, payload.defaultAssigneeName || '');
  setCol(TEMPLATE_COLS.SORT_ORDER, payload.sortOrder != null ? payload.sortOrder : 99);
  setCol(TEMPLATE_COLS.ACTIVE, payload.active != null ? payload.active : 'yes');
  setCol(TEMPLATE_COLS.CREATED_AT, now);
  setCol(TEMPLATE_COLS.UPDATED_AT, now);
  setCol(TEMPLATE_COLS.CREATED_BY, payload.createdBy || '');

  getTemplateFolder_(templateId);
  return findTemplate_(templateId);
}

function updateTemplate_(templateId, updates, actorEmail) {
  requireAdmin_(actorEmail);
  var sheet = getTemplatesSheet_();
  var map = getHeaderMap_(sheet);
  var all = listTemplates_(false);
  var target = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].templateId === templateId) {
      target = all[i];
      break;
    }
  }
  if (!target) throw new Error('Template not found');

  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var idCol = colIndex_(map, TEMPLATE_COLS.TEMPLATE_ID);
  var rowNum = null;
  for (var r = 0; r < data.length; r++) {
    if (idCol && String(data[r][idCol - 1]) === templateId) {
      rowNum = r + 2;
      break;
    }
  }
  if (!rowNum) throw new Error('Template row not found');

  var fieldMap = {
    title: TEMPLATE_COLS.TITLE,
    category: TEMPLATE_COLS.CATEGORY,
    instructions: TEMPLATE_COLS.INSTRUCTIONS,
    defaultAssigneeEmail: TEMPLATE_COLS.DEFAULT_ASSIGNEE_EMAIL,
    defaultAssigneeName: TEMPLATE_COLS.DEFAULT_ASSIGNEE_NAME,
    sortOrder: TEMPLATE_COLS.SORT_ORDER,
    active: TEMPLATE_COLS.ACTIVE,
  };

  Object.keys(updates).forEach(function (key) {
    var colName = fieldMap[key];
    if (!colName) return;
    var col = colIndex_(map, colName);
    if (col) sheet.getRange(rowNum, col).setValue(updates[key]);
  });

  var updatedCol = colIndex_(map, TEMPLATE_COLS.UPDATED_AT);
  if (updatedCol) sheet.getRange(rowNum, updatedCol).setValue(new Date().toISOString());

  return findTemplate_(templateId);
}

function deleteTemplate_(templateId, actorEmail) {
  return updateTemplate_(templateId, { active: 'no' }, actorEmail);
}

function listTemplateFiles_(templateId) {
  var sheet = getTemplateFilesSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var files = [];
  for (var i = 0; i < data.length; i++) {
    var f = rowToTemplateFile_(data[i], map);
    if (!f) continue;
    if (templateId && f.templateId !== templateId) continue;
    files.push(f);
  }
  return files;
}

function rowToTemplateFile_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }
  var id = cell(TEMPLATE_FILE_COLS.FILE_ID);
  if (!id) return null;
  return {
    fileId: id,
    templateId: cell(TEMPLATE_FILE_COLS.TEMPLATE_ID),
    fileName: cell(TEMPLATE_FILE_COLS.FILE_NAME),
    mimeType: cell(TEMPLATE_FILE_COLS.MIME_TYPE),
    driveFileId: cell(TEMPLATE_FILE_COLS.DRIVE_FILE_ID),
    driveUrl: cell(TEMPLATE_FILE_COLS.DRIVE_URL),
    sizeBytes: Number(cell(TEMPLATE_FILE_COLS.SIZE_BYTES)) || 0,
    uploadedAt: cell(TEMPLATE_FILE_COLS.UPLOADED_AT),
  };
}

function uploadTemplateFile_(payload) {
  requireAdmin_(payload.uploadedBy || payload.actorEmail);
  if (!payload.templateId || !payload.fileName || !payload.dataBase64) {
    throw new Error('templateId, fileName, dataBase64 required');
  }

  var bytes = Utilities.base64Decode(payload.dataBase64);
  if (bytes.length > CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds 10 MB limit');
  }

  var folder = getTemplateFolder_(payload.templateId);
  var blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.fileName);
  var driveFile = folder.createFile(blob);
  setOrgSharing_(driveFile);

  var sheet = getTemplateFilesSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var fileId = Utilities.getUuid();
  var now = new Date().toISOString();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(TEMPLATE_FILE_COLS.FILE_ID, fileId);
  setCol(TEMPLATE_FILE_COLS.TEMPLATE_ID, payload.templateId);
  setCol(TEMPLATE_FILE_COLS.FILE_NAME, payload.fileName);
  setCol(TEMPLATE_FILE_COLS.MIME_TYPE, payload.mimeType || '');
  setCol(TEMPLATE_FILE_COLS.DRIVE_FILE_ID, driveFile.getId());
  setCol(TEMPLATE_FILE_COLS.DRIVE_URL, driveFile.getUrl());
  setCol(TEMPLATE_FILE_COLS.SIZE_BYTES, bytes.length);
  setCol(TEMPLATE_FILE_COLS.UPLOADED_AT, now);

  return rowToTemplateFile_(sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0], map);
}

function deleteTemplateFile_(fileId, actorEmail) {
  requireAdmin_(actorEmail);
  var files = listTemplateFiles_(null);
  var target = null;
  for (var i = 0; i < files.length; i++) {
    if (files[i].fileId === fileId) {
      target = files[i];
      break;
    }
  }
  if (!target) throw new Error('File not found');

  if (target.driveFileId) {
    try {
      DriveApp.getFileById(target.driveFileId).setTrashed(true);
    } catch (ignore) {}
  }

  var sheet = getTemplateFilesSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var idCol = colIndex_(map, TEMPLATE_FILE_COLS.FILE_ID);
  for (var r = 0; r < data.length; r++) {
    if (idCol && String(data[r][idCol - 1]) === fileId) {
      sheet.deleteRow(r + 2);
      break;
    }
  }
  return { ok: true };
}

function copyTemplateFileToTask_(templateFile, eventCode, taskId) {
  if (!templateFile.driveFileId) return null;

  var folder = getTaskFolder_(eventCode, taskId);
  var src = DriveApp.getFileById(templateFile.driveFileId);
  var copy = src.makeCopy(templateFile.fileName, folder);
  setOrgSharing_(copy);

  var sheet = getFilesSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var fileId = Utilities.getUuid();
  var now = new Date().toISOString();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(FILE_COLS.FILE_ID, fileId);
  setCol(FILE_COLS.EVENT_CODE, eventCode);
  setCol(FILE_COLS.TASK_ID, taskId);
  setCol(FILE_COLS.FILE_NAME, templateFile.fileName);
  setCol(FILE_COLS.MIME_TYPE, templateFile.mimeType);
  setCol(FILE_COLS.DRIVE_FILE_ID, copy.getId());
  setCol(FILE_COLS.DRIVE_URL, copy.getUrl());
  setCol(FILE_COLS.UPLOADED_BY, 'template');
  setCol(FILE_COLS.UPLOADED_AT, now);
  setCol(FILE_COLS.SIZE_BYTES, templateFile.sizeBytes);

  return rowToFile_(sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0], map);
}

function applyTemplatesToEvent_(eventCode, eventRowId, templateIds, actorEmail) {
  if (!eventCode || !templateIds || !templateIds.length) {
    throw new Error('eventCode and templateIds required');
  }

  var event = findEventRow_(eventRowId, eventCode);
  if (!event) throw new Error('Event not found');

  var created = [];
  templateIds.forEach(function (templateId) {
    var tmpl = findTemplate_(templateId);
    if (!tmpl || String(tmpl.active).toLowerCase() === 'no') return;

    var task = createTask_({
      eventCode: event.code,
      eventRowId: event.rowId,
      title: tmpl.title,
      category: tmpl.category,
      instructions: tmpl.instructions,
      assigneeEmail: tmpl.defaultAssigneeEmail,
      assigneeName: tmpl.defaultAssigneeName,
      templateId: tmpl.templateId,
      vendorVisible: 'yes',
      status: 'todo',
      createdBy: actorEmail || 'template',
    });

    var tmplFiles = listTemplateFiles_(templateId);
    tmplFiles.forEach(function (tf) {
      copyTemplateFileToTask_(tf, event.code, task.taskId);
    });

    created.push(task);
  });

  logActivity_(
    'templates_applied',
    event.code,
    '',
    created.length + ' tasks from templates',
    actorEmail || ''
  );

  return { tasks: created, count: created.length };
}

function getTemplateWithFiles_(templateId) {
  var t = findTemplate_(templateId);
  if (!t) return null;
  return {
    template: t,
    files: listTemplateFiles_(templateId),
  };
}

function listTemplatesWithFiles_(activeOnly) {
  return listTemplates_(activeOnly).map(function (t) {
    return {
      template: t,
      files: listTemplateFiles_(t.templateId),
    };
  });
}
