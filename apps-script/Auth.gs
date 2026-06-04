/**
 * Admin access — set ADMIN_EMAILS in Script properties (comma-separated).
 * Example: lead@company.org,admin@company.org
 */

function getAdminEmails_() {
  var raw = getScriptProperty_('ADMIN_EMAILS', true);
  if (!raw) return [];
  return raw
    .split(',')
    .map(function (e) {
      return e.trim().toLowerCase();
    })
    .filter(function (e) {
      return e && e.indexOf('@') > 0;
    });
}

function isAdmin_(email) {
  if (!email) return false;
  var admins = getAdminEmails_();
  if (admins.length === 0) {
    // Fallback: script owner is admin when list not configured
    try {
      return email.toLowerCase() === Session.getEffectiveUser().getEmail().toLowerCase();
    } catch (e) {
      return false;
    }
  }
  return admins.indexOf(String(email).trim().toLowerCase()) >= 0;
}

function requireAdmin_(email) {
  if (!isAdmin_(email)) {
    throw new Error('Admin permission required');
  }
}

// getActorEmail_ lives in Config.gs (shared by all services)
