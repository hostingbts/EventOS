function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  return {};
}

function handleRequest_(e, method) {
  try {
    var body = method === 'POST' ? parseBody_(e) : {};
    var action = (e && e.parameter && e.parameter.action) || body.action || '';
    var vendorToken =
      (e && e.parameter && e.parameter.vendorToken) || body.vendorToken || '';

    // ——— Vendor portal (no API token) ———
    if (vendorToken || action === 'vendorWorkspace') {
      return handleVendorRequest_(vendorToken || body.vendorToken, action, body);
    }

    if (!verifyToken_(e)) {
      return jsonResponse_({ error: 'Unauthorized' }, 401);
    }

    var actorEmail = getActorEmail_(body, e);

    // ——— Auth check ———
    if (action === 'whoami') {
      return jsonResponse_({
        isAdmin: isAdmin_(actorEmail),
        email: actorEmail,
      });
    }

    // ——— Events ———
    if (action === 'list' || action === '' || !action) {
      return jsonResponse_(listEvents_());
    }

    if (action === 'get') {
      var code = e.parameter.code || body.code || '';
      var rowId = e.parameter.rowId || body.rowId || '';
      var ev = findEventRow_(rowId, code);
      if (!ev) return jsonResponse_({ error: 'Not found' }, 404);
      return jsonResponse_(ev);
    }

    if (action === 'update' && method === 'POST') {
      var target = findEventRow_(body.rowId, body.code);
      if (!target) return jsonResponse_({ error: 'Not found' }, 404);
      updateEventFields_(target.rowNumber, body.updates || {});
      return jsonResponse_(findEventRow_(target.rowId, target.code));
    }

    if (action === 'eventCreate' && method === 'POST') {
      body.createdBy = actorEmail || body.createdBy || '';
      return jsonResponse_(createEvent_(body));
    }

    if (action === 'workspace') {
      var eventCode = e.parameter.eventCode || body.eventCode || '';
      var eventRowId = e.parameter.eventRowId || body.eventRowId || '';
      var event = findEventRow_(eventRowId, eventCode);
      if (!event) return jsonResponse_({ error: 'Event not found' }, 404);
      return jsonResponse_({
        event: event,
        tasks: listTasks_(event.code, event.rowId),
        comments: listComments_(event.code, null),
        files: listFiles_(event.code, null),
        activity: listActivity_(event.code, 50),
        vendorLink: getActiveVendorLinkForEvent_(event.code),
      });
    }

    // ——— Task templates ———
    if (action === 'templatesList') {
      var withFiles = e.parameter.withFiles === 'true' || body.withFiles === true;
      if (withFiles) {
        return jsonResponse_({ templates: listTemplatesWithFiles_(true) });
      }
      return jsonResponse_({ templates: listTemplates_(true) });
    }

    if (action === 'templateGet') {
      var tid = e.parameter.templateId || body.templateId || '';
      var data = getTemplateWithFiles_(tid);
      if (!data) return jsonResponse_({ error: 'Not found' }, 404);
      return jsonResponse_(data);
    }

    if (action === 'templateCreate' && method === 'POST') {
      requireAdmin_(actorEmail);
      return jsonResponse_(createTemplate_(body));
    }

    if (action === 'templateUpdate' && method === 'POST') {
      return jsonResponse_(updateTemplate_(body.templateId, body.updates || {}, actorEmail));
    }

    if (action === 'templateDelete' && method === 'POST') {
      return jsonResponse_(deleteTemplate_(body.templateId, actorEmail));
    }

    if (action === 'templateFileUpload' && method === 'POST') {
      body.uploadedBy = actorEmail;
      body.actorEmail = actorEmail;
      return jsonResponse_(uploadTemplateFile_(body));
    }

    if (action === 'templateFileDelete' && method === 'POST') {
      return jsonResponse_(deleteTemplateFile_(body.fileId, actorEmail));
    }

    if (action === 'applyTemplates' && method === 'POST') {
      return jsonResponse_(
        applyTemplatesToEvent_(body.eventCode, body.eventRowId, body.templateIds || [], actorEmail)
      );
    }

    // ——— Vendor links (team) ———
    if (action === 'vendorLinksList') {
      var listEc = e.parameter.eventCode || body.eventCode || '';
      var allLinks = listVendorLinks_(listEc).filter(function (l) {
        return String(l.active).toLowerCase() === 'yes';
      });
      return jsonResponse_({ links: allLinks });
    }

    if (action === 'vendorLinkGet') {
      var ec = e.parameter.eventCode || body.eventCode || '';
      var er = e.parameter.eventRowId || body.eventRowId || '';
      var opts = {
        vendorCategory: e.parameter.vendorCategory || body.vendorCategory || '',
        vendorName: e.parameter.vendorName || body.vendorName || '',
        permission: e.parameter.permission || body.permission || 'view',
        label: e.parameter.label || body.label || '',
      };
      return jsonResponse_({ link: getOrCreateVendorLink_(ec, er, actorEmail, opts) });
    }

    if (action === 'vendorLinkRegenerate' && method === 'POST') {
      return jsonResponse_({
        link: regenerateVendorLink_(body.eventCode, body.eventRowId, actorEmail, {
          vendorCategory: body.vendorCategory || '',
          vendorName: body.vendorName || '',
          permission: body.permission || 'view',
          label: body.label || '',
        }),
      });
    }

    if (action === 'vendorLinkRevoke' && method === 'POST') {
      return jsonResponse_(revokeVendorLink_(body.linkId, actorEmail));
    }

    // ——— Tasks ———
    if (action === 'tasksList') {
      return jsonResponse_({
        tasks: listTasks_(e.parameter.eventCode || body.eventCode, e.parameter.eventRowId || body.eventRowId),
      });
    }

    if (action === 'taskCreate' && method === 'POST') {
      return jsonResponse_(createTask_(body));
    }

    if (action === 'taskUpdate' && method === 'POST') {
      return jsonResponse_(updateTask_(body.taskId, body.updates || {}, actorEmail));
    }

    // ——— Comments ———
    if (action === 'commentsList') {
      return jsonResponse_({
        comments: listComments_(e.parameter.eventCode || body.eventCode, e.parameter.taskId || body.taskId || null),
      });
    }

    if (action === 'commentAdd' && method === 'POST') {
      return jsonResponse_(addComment_(body));
    }

    // ——— Files ———
    if (action === 'filesList') {
      return jsonResponse_({
        files: listFiles_(e.parameter.eventCode || body.eventCode, e.parameter.taskId || body.taskId || null),
      });
    }

    if (action === 'fileUpload' && method === 'POST') {
      return jsonResponse_(uploadFile_(body));
    }

    if (action === 'fileDelete' && method === 'POST') {
      return jsonResponse_(deleteFile_(body.fileId, actorEmail));
    }

    // ——— Team ———
    if (action === 'activity') {
      return jsonResponse_({
        activity: listActivity_(e.parameter.eventCode || body.eventCode || null, Number(e.parameter.limit) || 30),
      });
    }

    if (action === 'team') {
      return jsonResponse_(getTeamOverview_());
    }

    if (action === 'digest') {
      return jsonResponse_(generateWeeklyDigest_());
    }

    if (action === 'health') {
      return jsonResponse_({ ok: true, time: new Date().toISOString() });
    }

    // ——— Accounts ———
    if (action === 'authList') {
      requireAdmin_(actorEmail);
      return jsonResponse_({ accounts: listAccounts_() });
    }

    if (action === 'authRegister' && method === 'POST') {
      return jsonResponse_(registerAccount_(body.name, body.email, body.passwordHash));
    }

    if (action === 'authLogin' && method === 'POST') {
      var loginResult = verifyAccount_(body.email, body.passwordHash);
      return jsonResponse_({ account: loginResult });
    }

    if (action === 'authChangePassword' && method === 'POST') {
      changeAccountPassword_(body.email, body.newHash);
      return jsonResponse_({ ok: true });
    }

    // ——— Org members ———
    if (action === 'membersList') {
      return jsonResponse_({ members: listMembers_() });
    }

    if (action === 'membersUpsert' && method === 'POST') {
      return jsonResponse_(upsertMember_(body.member));
    }

    if (action === 'membersDeactivate' && method === 'POST') {
      deactivateMember_(body.id);
      return jsonResponse_({ ok: true });
    }

    // ——— Role capabilities ———
    if (action === 'capsList') {
      return jsonResponse_({ matrix: getCapMatrixFromSheet_() });
    }

    if (action === 'capsSave' && method === 'POST') {
      requireAdmin_(actorEmail);
      saveCapMatrixToSheet_(body.matrix);
      return jsonResponse_({ ok: true });
    }

    return jsonResponse_({ error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return jsonResponse_({ error: String(err.message || err) }, 500);
  }
}

function handleVendorRequest_(vendorToken, action, body) {
  var token = vendorToken || (body && body.vendorToken) || '';
  if (!token) {
    return jsonResponse_({ error: 'vendorToken required' }, 401);
  }

  if (action === 'vendorWorkspace' || action === '' || !action) {
    return jsonResponse_(getVendorWorkspace_(token));
  }

  return jsonResponse_({ error: 'Unknown vendor action' }, 400);
}

function getActiveVendorLinkForEvent_(eventCode) {
  var links = listVendorLinks_(eventCode);
  for (var i = 0; i < links.length; i++) {
    if (String(links[i].active).toLowerCase() === 'yes') {
      return links[i];
    }
  }
  return null;
}

function verifyToken_(e) {
  var expected = getApiToken_();
  var token = '';
  if (e && e.parameter && e.parameter.token) {
    token = e.parameter.token;
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var b = JSON.parse(e.postData.contents);
      if (b.token) token = b.token;
    } catch (ignore) {}
  }
  return token && token === expected;
}

function jsonResponse_(obj, status) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
