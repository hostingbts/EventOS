var FILE_COLS = {
  FILE_ID: 'File ID',
  EVENT_CODE: 'Event Code',
  TASK_ID: 'Task ID',
  FILE_NAME: 'File Name',
  MIME_TYPE: 'MIME Type',
  DRIVE_FILE_ID: 'Drive File ID',
  DRIVE_URL: 'Drive URL',
  UPLOADED_BY: 'Uploaded By',
  UPLOADED_AT: 'Uploaded At',
  SIZE_BYTES: 'Size Bytes',
};

function getFilesSheet_() {
  return getOrCreateSheet_(CONFIG.FILES_SHEET, Object.values(FILE_COLS));
}

function getDriveRootFolder_() {
  var folderId = getScriptProperty_('DRIVE_ROOT_FOLDER_ID', true) || DEFAULT_DRIVE_ROOT_FOLDER_ID;
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log('DRIVE_ROOT_FOLDER_ID not accessible, falling back to "Event Ops Files": ' + e);
    }
  }
  var rootName = 'Event Ops Files';
  var iter = DriveApp.getFoldersByName(rootName);
  if (iter.hasNext()) return iter.next();
  return DriveApp.createFolder(rootName);
}

/**
 * Returns the Drive folder for an event (the top-level folder, not the task sub-folder).
 * Creates it (and the standard subfolders) if it doesn't exist yet.
 */
function getOrCreateEventFolder_(eventCode, location) {
  var root = getDriveRootFolder_();
  var folderName = location ? (eventCode + ' - ' + location) : eventCode;

  // Try to find an existing folder matching the event code prefix
  var iter = root.getFoldersByName(folderName);
  if (iter.hasNext()) return iter.next();

  // Also try by code only (in case location changed)
  var iterCode = root.getFoldersByName(eventCode);
  if (iterCode.hasNext()) return iterCode.next();

  // Create the event folder and restrict to org domain
  var eventFolder = root.createFolder(folderName);
  setOrgSharing_(eventFolder);

  // Create standard subfolders, each also restricted to org domain
  EVENT_SUBFOLDERS.forEach(function (name) {
    var sub = eventFolder.createFolder(name);
    setOrgSharing_(sub);
  });

  return eventFolder;
}

// createEventDriveFolders_ is defined in SheetService.gs (used when creating events)

var TRANSFER_LISTS_SUBFOLDER_ = 'Transfer Lists';

function getEventSubfolder_(eventCode, location, subfolderName) {
  var eventFolder = getOrCreateEventFolder_(eventCode, location || '');
  var iter = eventFolder.getFoldersByName(subfolderName);
  if (iter.hasNext()) return iter.next();
  var sub = eventFolder.createFolder(subfolderName);
  setOrgSharing_(sub);
  return sub;
}

/** Update an existing Drive file's binary content in place (keeps the same file ID / link). */
function updateTransferListFileContent_(fileId, blob, fileName) {
  var response = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media',
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      },
      contentType: blob.getContentType(),
      payload: blob.getBytes(),
      muteHttpExceptions: true,
    }
  );

  if (response.getResponseCode() >= 300) {
    throw new Error(
      'Drive update failed (' +
        response.getResponseCode() +
        '): ' +
        response.getContentText().slice(0, 200)
    );
  }

  var file = DriveApp.getFileById(fileId);
  if (fileName && file.getName() !== fileName) {
    file.setName(fileName);
  }
  return file;
}

/**
 * Upload (or update in place) a transfer list .xlsx in the event's Transfer Lists folder.
 * Reuses the same Drive file ID when possible so vendor links stay stable.
 */
function uploadTransferList_(payload) {
  if (!payload.eventCode || !payload.fileName || !payload.dataBase64) {
    throw new Error('eventCode, fileName and dataBase64 required');
  }

  var bytes = Utilities.base64Decode(payload.dataBase64);
  if (bytes.length > CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds 10 MB limit');
  }

  var ev = findEventRow_(payload.eventRowId || '', payload.eventCode);
  var location = ev ? ev.location : payload.eventLocation || '';

  var folder = getEventSubfolder_(payload.eventCode, location, TRANSFER_LISTS_SUBFOLDER_);

  var mime =
    payload.mimeType ||
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var blob = Utilities.newBlob(bytes, mime, payload.fileName);

  var existingFile = findTransferListDriveFile_(folder, payload.driveFileId, payload.fileName);
  var driveFile;

  if (existingFile) {
    driveFile = updateTransferListFileContent_(existingFile.getId(), blob, payload.fileName);
  } else {
    driveFile = folder.createFile(blob);
    setOrgSharing_(driveFile);
  }

  var fileId = driveFile.getId();
  var shareUrl = 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing';

  logActivity_(
    'transfer_list_saved',
    payload.eventCode,
    '',
    payload.fileName,
    payload.uploadedBy || payload.actorEmail || '',
  );

  return {
    driveFileId: fileId,
    driveUrl: shareUrl,
    fileName: payload.fileName,
  };
}

/** Find an existing transfer list file to update — by ID first, then by name in folder. */
function findTransferListDriveFile_(folder, driveFileId, fileName) {
  if (driveFileId) {
    try {
      var byId = DriveApp.getFileById(driveFileId);
      if (!byId.isTrashed()) return byId;
    } catch (e) {
      Logger.log('findTransferListDriveFile_ id lookup failed: ' + e);
    }
  }

  if (!fileName) return null;

  var iter = folder.getFilesByName(fileName);
  if (!iter.hasNext()) return null;

  var primary = iter.next();
  while (iter.hasNext()) {
    iter.next().setTrashed(true);
  }
  return primary;
}

function getTaskFolder_(eventCode, taskId) {
  var root = getDriveRootFolder_();
  var eventFolders = root.getFoldersByName(eventCode);
  // Also check for "code - location" style folders
  var eventFolder;
  if (eventFolders.hasNext()) {
    eventFolder = eventFolders.next();
  } else {
    // Search for any folder starting with the event code
    var allFolders = root.getFolders();
    while (allFolders.hasNext()) {
      var f = allFolders.next();
      if (f.getName().indexOf(eventCode) === 0) {
        eventFolder = f;
        break;
      }
    }
    if (!eventFolder) {
      eventFolder = root.createFolder(eventCode);
    }
  }
  var taskFolderName = taskId;
  var taskFolders = eventFolder.getFoldersByName(taskFolderName);
  return taskFolders.hasNext() ? taskFolders.next() : eventFolder.createFolder(taskFolderName);
}

function listFiles_(eventCode, taskId) {
  var sheet = getFilesSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var files = [];

  for (var i = 0; i < data.length; i++) {
    var f = rowToFile_(data[i], map);
    if (!f) continue;
    if (eventCode && f.eventCode !== eventCode) continue;
    if (taskId && f.taskId !== taskId) continue;
    files.push(f);
  }
  return files;
}

function rowToFile_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }

  var id = cell(FILE_COLS.FILE_ID);
  if (!id) return null;

  return {
    fileId: id,
    eventCode: cell(FILE_COLS.EVENT_CODE),
    taskId: cell(FILE_COLS.TASK_ID),
    fileName: cell(FILE_COLS.FILE_NAME),
    mimeType: cell(FILE_COLS.MIME_TYPE),
    driveFileId: cell(FILE_COLS.DRIVE_FILE_ID),
    driveUrl: cell(FILE_COLS.DRIVE_URL),
    uploadedBy: cell(FILE_COLS.UPLOADED_BY),
    uploadedAt: cell(FILE_COLS.UPLOADED_AT),
    sizeBytes: Number(cell(FILE_COLS.SIZE_BYTES)) || 0,
  };
}

function uploadFile_(payload) {
  if (!payload.fileName || !payload.dataBase64) {
    throw new Error('fileName and dataBase64 required');
  }

  var bytes = Utilities.base64Decode(payload.dataBase64);
  if (bytes.length > CONFIG.MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds 10 MB limit');
  }

  var task = findTask_(payload.taskId);
  if (!task) throw new Error('Task not found');

  var folder = getTaskFolder_(payload.eventCode || task.eventCode, payload.taskId);
  var blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.fileName);
  var driveFile = folder.createFile(blob);
  setOrgSharing_(driveFile);

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
  setCol(FILE_COLS.EVENT_CODE, task.eventCode);
  setCol(FILE_COLS.TASK_ID, payload.taskId);
  setCol(FILE_COLS.FILE_NAME, payload.fileName);
  setCol(FILE_COLS.MIME_TYPE, payload.mimeType || '');
  setCol(FILE_COLS.DRIVE_FILE_ID, driveFile.getId());
  setCol(FILE_COLS.DRIVE_URL, driveFile.getUrl());
  setCol(FILE_COLS.UPLOADED_BY, payload.uploadedBy || '');
  setCol(FILE_COLS.UPLOADED_AT, now);
  setCol(FILE_COLS.SIZE_BYTES, bytes.length);

  logActivity_('file_uploaded', task.eventCode, payload.taskId, payload.fileName, payload.uploadedBy);

  return rowToFile_(sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0], map);
}

function deleteFile_(fileId, actorEmail) {
  var files = listFiles_(null, null);
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

  var sheet = getFilesSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var idCol = colIndex_(map, FILE_COLS.FILE_ID);

  for (var r = 0; r < data.length; r++) {
    if (idCol && String(data[r][idCol - 1]) === fileId) {
      sheet.deleteRow(r + 2);
      break;
    }
  }

  logActivity_('file_deleted', target.eventCode, target.taskId, target.fileName, actorEmail || '');
  return { ok: true };
}
