# Wedding seating planner

Seating planner for wedding halls and planners: hall layout (tables, stage, dance floor…),
guest list with groups and meals, drag-to-seat, print/PDF, Armenian / Russian / English.

```
wedding-project/   React + Vite + Mantine frontend
wedding-backend/   Express backend (accounts, events, couple link, QR page)
```

## Run locally

```bash
# backend → http://localhost:5000
cd wedding-backend && npm install && node server.js

# frontend → http://localhost:5173
cd wedding-project && npm install && npx vite --port 5173
```

## Deploy (Vercel, no backend)

`vercel.json` builds `wedding-project/` as a static site. Without `VITE_API_URL` the app runs in
**local mode**: all data is kept in the browser's localStorage (no login; couple link and QR page
are hidden). Use **Backup → Download / Import** on the dashboard to keep or move the data.

Vercel project settings: Root Directory `./`, Framework Preset **Other**, no `VITE_API_URL`.

To use the backend instead, deploy `wedding-backend/` somewhere with persistent storage and
build the frontend with `VITE_API_URL=https://your-backend`.
