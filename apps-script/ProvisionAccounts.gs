/**
 * One-time account provisioning — run from the Apps Script editor.
 *
 * 1. Open the bound script → select `provisionNoemiAccount_` → Run
 * 2. Authorize if prompted
 * 3. Share the generated password with the user securely (do not commit passwords)
 *
 * Hash precomputed with client salt evos-2026-cm — see team password manager.
 */

var NOEMI_EMAIL = 'translations@connectmice.com';
var NOEMI_HASH  = '15ffaaf9810c824867091bec62729006894417af3a474f04f162541cec7a26d9';

function provisionNoemiAccount_() {
  var existing = findAccountRow_(NOEMI_EMAIL);
  if (!existing) {
    registerAccount_('Noemi', NOEMI_EMAIL, NOEMI_HASH);
    Logger.log('Created auth account for ' + NOEMI_EMAIL);
  } else {
    Logger.log('Auth account already exists for ' + NOEMI_EMAIL);
  }

  upsertMember_({
    id: 'member-noemi',
    name: 'Noemi',
    email: NOEMI_EMAIL,
    role: 'project_lead',
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
    invitedBy: 'admin@connectmice.com',
  });
  Logger.log('Upserted org member Noemi (project_lead)');
}
