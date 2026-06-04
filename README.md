# Event Ops

Budget-friendly event tracker for team leads: **Google Sheets** as the database, **Apps Script** for API + email reminders + **Gemini** AI, and a **React PWA** for web and iOS (Add to Home Screen).

## Quick start (demo)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 — runs with **mock data** until you connect Google.

## Project structure

```
event-ops/
├── apps-script/     # Paste into bound Apps Script project
├── docs/SETUP.md    # Full Google + deploy instructions
├── docs/sheet-headers.csv
└── web/             # React + Vite PWA (your brand colors)
```

## Brand colors

| Name | Hex |
|------|-----|
| Grassy Green | `#9bc400` |
| Purple Mountains Majesty | `#8076a3` |
| Misty Mountain Pink | `#f9c5bd` |
| Factory Stone Purple | `#7c677f` |

## Connect Google

1. Follow [docs/SETUP.md](docs/SETUP.md)
2. Copy `web/.env.example` → `web/.env`
3. Set `VITE_API_URL` (Apps Script `/exec` URL) and `VITE_API_TOKEN`

## Features

- **Team workspace** per event — task board, assignees, status columns
- **Per-task file uploads** — contracts, quotes, plans (Google Drive in production)
- **Comments** on each task and event-wide discussion
- **Team page** — who is assigned to what across events
- Month-grouped event dashboard (matches your spreadsheet)
- Edit event status from overview tab
- Daily email reminders + optional Gemini digest
- PWA for iOS (Add to Home Screen)

## Deploy web (free)

```bash
cd web && npm run build
# Upload dist/ to Vercel or Cloudflare Pages
```

## License

Private / internal use — customize as needed.
