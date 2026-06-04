var COMMENT_COLS = {
  COMMENT_ID: 'Comment ID',
  EVENT_CODE: 'Event Code',
  TASK_ID: 'Task ID',
  AUTHOR_EMAIL: 'Author Email',
  AUTHOR_NAME: 'Author Name',
  BODY: 'Body',
  CREATED_AT: 'Created At',
};

function getCommentsSheet_() {
  return getOrCreateSheet_(CONFIG.COMMENTS_SHEET, Object.values(COMMENT_COLS));
}

function listComments_(eventCode, taskId) {
  var sheet = getCommentsSheet_();
  var map = getHeaderMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var comments = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var c = rowToComment_(row, map);
    if (!c) continue;
    if (eventCode && c.eventCode !== eventCode) continue;
    if (taskId && c.taskId !== taskId) continue;
    comments.push(c);
  }

  comments.sort(function (a, b) {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
  return comments;
}

function rowToComment_(row, map) {
  function cell(name) {
    var c = colIndex_(map, name);
    if (!c) return '';
    return row[c - 1] != null ? String(row[c - 1]) : '';
  }

  var id = cell(COMMENT_COLS.COMMENT_ID);
  if (!id) return null;

  return {
    commentId: id,
    eventCode: cell(COMMENT_COLS.EVENT_CODE),
    taskId: cell(COMMENT_COLS.TASK_ID),
    authorEmail: cell(COMMENT_COLS.AUTHOR_EMAIL),
    authorName: cell(COMMENT_COLS.AUTHOR_NAME),
    body: cell(COMMENT_COLS.BODY),
    createdAt: cell(COMMENT_COLS.CREATED_AT),
  };
}

function addComment_(payload) {
  var sheet = getCommentsSheet_();
  var map = getHeaderMap_(sheet);
  var row = sheet.getLastRow() + 1;
  var commentId = Utilities.getUuid();
  var now = new Date().toISOString();

  function setCol(name, val) {
    var c = colIndex_(map, name);
    if (c) sheet.getRange(row, c).setValue(val);
  }

  setCol(COMMENT_COLS.COMMENT_ID, commentId);
  setCol(COMMENT_COLS.EVENT_CODE, payload.eventCode);
  setCol(COMMENT_COLS.TASK_ID, payload.taskId || '');
  setCol(COMMENT_COLS.AUTHOR_EMAIL, payload.authorEmail || '');
  setCol(COMMENT_COLS.AUTHOR_NAME, payload.authorName || '');
  setCol(COMMENT_COLS.BODY, payload.body);
  setCol(COMMENT_COLS.CREATED_AT, now);

  logActivity_('comment_added', payload.eventCode, payload.taskId || '', payload.body.substring(0, 80), payload.authorEmail);

  return {
    commentId: commentId,
    eventCode: payload.eventCode,
    taskId: payload.taskId || '',
    authorEmail: payload.authorEmail,
    authorName: payload.authorName,
    body: payload.body,
    createdAt: now,
  };
}
