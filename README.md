# Wedding seating planner

Seating planner for wedding halls and planners: hall layout (tables, stage, dance floor…),
guest list with groups and meals, drag-to-seat, print/PDF, Armenian / Russian / English.

The app lives in `wedding-project/` (React + Vite + Mantine). It needs no backend: all weddings,
templates and settings are kept in the browser's localStorage. Use **Backup → Download / Import**
on the dashboard to keep a copy or move the data to another browser.

## Run locally

```bash
cd wedding-project
npm install
npx vite --port 5173
```

## Deploy (Vercel)

Vercel project settings: **Root Directory** `wedding-project`, **Framework Preset** Vite.
Every push to `main` deploys automatically.

## Backend (optional, not used now)

The frontend still contains the client for a backend server (accounts, couple share link,
QR "find your table" page). It is only used when the app is built with `VITE_API_URL` set.
The previous Express backend is in this repository's git history.
