# Event Ops — Setup Guide

Connect your Google Sheet, Apps Script API, email reminders, and the web/iOS PWA.

## 1. Google Sheet

1. Create a spreadsheet (or use your existing tracker).
2. Add a tab named **Events** (or set `SHEET_NAME` in Script properties).
3. Row 1 headers (exact names):

| Code | Location | Dates | LEM | AV | Interpreters | VENUE | PSA/CLDP | SOW | Notes | Month Group | Start Date | End Date | Owner Email | Last Reminder | Row ID |
|------|----------|-------|-----|----|--------------|-------|----------|-----|-------|-------------|------------|----------|-------------|---------------|--------|

4. **Month separator rows**: put the month label in **Month Group** (e.g. `May 2026`) with **Code** empty.
5. **Start Date** / **End Date**: use real dates (`2026-05-01`) for email reminders.
6. **Data validation** (optional): LEM = `Open`, `Closed`, `Full/Connectmice`; AV = `Yes`, `No`; Interpreters = `PSA`, `Connectmice`, `NO`.

Import sample structure from `docs/sheet-headers.csv`.

## 2. Apps Script

1. In the spreadsheet: **Extensions → Apps Script** (recommended — script stays bound to the sheet).
   - If you already created a standalone project at script.google.com, set **`SPREADSHEET_ID`** in Script properties instead.
2. Delete default `Code.gs` content.
3. Create one file per file in this repo’s `apps-script/` folder (or run `clasp push` from `apps-script/`).
4. **Project settings → Script properties**:

| Property | Value |
|----------|--------|
| `API_TOKEN` | Long random string (e.g. `openssl rand -hex 32`) |
| `SPREADSHEET_ID` | **Required** if the script is standalone (created at script.google.com). The Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit` |
| `GEMINI_API_KEY` | Optional — [Google AI Studio](https://aistudio.google.com/apikey) |
| `EVENT_MANAGER_EMAIL` | Email for weekly digest |
| `SHEET_NAME` | Optional — default `Events` |

5. Run once from the editor:
   - `backfillRowIds` — stable IDs for each row
   - `setupRemindersTrigger` — daily deadline emails (8:00 script timezone)
   - `setupWeeklyDigestTrigger` — optional Monday AI digest

6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone in your organization** (or *Anyone* if personal Gmail + token auth)
7. Copy the **Web app URL** (`.../exec`).

### CORS note

The React app calls the script URL with `?token=`. If the browser blocks requests, deploy with access “Anyone” and rely on `API_TOKEN`, or proxy via a small Cloudflare Worker later.

## 3. Google Form (optional)

Create a form with fields matching `FormHandler.gs`, link responses to the sheet, then:

**Triggers → Add trigger → On form submit → `onFormSubmitHandler`**

## 4. Admin emails & templates

In Script properties, set:

| Property | Value |
|----------|--------|
| `ADMIN_EMAILS` | Comma-separated emails allowed to manage task templates |

Demo web app: set `VITE_ADMIN_EMAILS` in `web/.env` (or use an email containing `admin` or `lead`).

### Task templates (admin)

- Tab **Task Templates** + **Template Files** are created automatically
- Admins create templates with instructions and reference files
- Any team member can **Add from templates** on an event workspace
- Selected templates create tasks (with assignees) and copy attached files into each task

### Vendor links

- Each event can have a **vendor portal link** (read-only)
- Vendors see only that event’s tasks marked vendor-visible, plus instructions and files
- Regenerating a link invalidates the previous URL

Vendor URL format: `https://your-site.com/vendor/{token}`

## 5. Collaboration sheets (auto-created)

On first API call, Apps Script creates these tabs if missing:

| Tab | Purpose |
|-----|---------|
| **Tasks** | Per-event checklist (LEM, AV, venue, SOW, etc.) |
| **Comments** | Team discussion on events and tasks |
| **Files** | Metadata for uploads (files live in Google Drive) |
| **Activity** | Audit log of changes |

**Drive:** Files upload to `Event Ops Files / {Event Code} / {Task ID} /`. Optional: set `DRIVE_ROOT_FOLDER_ID` in Script properties to use a shared team folder.

## 6. Web app

```bash
cd web
cp .env.example .env
# Edit VITE_API_URL and VITE_API_TOKEN
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Deploy `web/dist` to [Vercel](https://vercel.com) or Cloudflare Pages (free).

## 5. iOS (PWA)

1. Deploy the website over **HTTPS**.
2. On iPhone: open in **Safari** → **Share** → **Add to Home Screen**.
3. Opens full-screen like an app; uses the same API as the website.

## 6. Email reminders

Daily job `runDailyReminders` sends when:

| Condition | When |
|-----------|------|
| Event approaching | 30, 14, 7, 1 days before **Start Date** |
| Missing SOW | 21, 14, 7 days before (if SOW empty or `??`) |
| Missing venue | 14, 7 days before |
| LEM not Closed | 7 days before |

Recipients: **Owner Email** + **EVENT_MANAGER_EMAIL**.

## 7. AI (Gemini)

- Weekly digest: `sendWeeklyDigestEmail` (after `setupWeeklyDigestTrigger`)
- Test in editor: `generateWeeklyDigest_()` or `draftChaseEmailForEvent('J182-4')`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Empty app | Check headers match `Config.gs`; run `testListEvents` |
| 401 Unauthorized | Match `API_TOKEN` and `VITE_API_TOKEN` |
| No emails | Authorize MailApp on first run; confirm **Start Date** filled |
| Demo mode | Leave `VITE_API_URL` empty — mock data loads automatically |
