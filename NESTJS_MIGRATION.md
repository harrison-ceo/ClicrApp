# NestJS Backend + React Query / Axios Migration

This project now includes a **NestJS backend** and **React Query + Axios** on the frontend. You can run either the existing Next.js API routes or the Nest backend.

## What Was Added

### Backend (`/backend`)

- **NestJS app** with:
  - `GET /api/sync` – full app state (venues, areas, clicrs, events, etc.) from Supabase
  - `POST /api/sync` – actions: `RECORD_EVENT`, `RECORD_SCAN`, `RESET_COUNTS`, `ADD_CLICR`, `DELETE_CLICR`, `UPDATE_VENUE`, `UPDATE_AREA`, `DELETE_ACCOUNT`
  - `POST /api/log-error` – client error logging
  - `POST /api/reports/aggregate` – occupancy report aggregation
- **Supabase** as the only data store (no `db.json` in Nest; state is built from Supabase).
- **CORS** configured for your Next.js origin.

### Frontend

- **@tanstack/react-query** and **axios** in `package.json`.
- **`lib/api/`**:
  - `client.ts` – Axios instance with `baseURL` from `NEXT_PUBLIC_API_URL`
  - `sync.ts` – `fetchSyncState()`, `postSyncAction()` (auth headers from Supabase session)
  - `log-error.ts` – `logErrorToBackend()`
  - `reports.ts` – `fetchAggregateReport()`
  - `hooks.ts` – `useSyncState()`, `useSyncMutation()`, `useAggregateReport()`
- **Providers** – Root layout wraps the app in `QueryClientProvider`.
- **Store** – When `NEXT_PUBLIC_API_URL` is set, `refreshState` and `authFetch` call the Nest backend instead of Next.js API routes.

## What You Need To Do

### 1. Install dependencies

**Frontend (root):**

```bash
npm install
```

**Backend:**

```bash
cd backend && npm install
```

### 2. Environment variables

**Frontend (`.env.local`):**

- Keep existing Supabase vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Required to use Nest:** add `NEXT_PUBLIC_API_URL=http://localhost:3001` (or your Nest server URL). All `/api/sync`, `/api/log-error`, and store/UI API calls then go to Nest. **Restart the Next.js dev server** after adding or changing this so the client gets the value.

**Backend (`backend/.env`):**

- Copy `backend/.env.example` to `backend/.env`.
- Set:
  - `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) – same as frontend.
  - `SUPABASE_SERVICE_ROLE_KEY` – from Supabase dashboard (not the anon key).
  - `PORT=3001` (optional; default is 3001).
  - `CORS_ORIGIN=http://localhost:3000` (your Next.js dev URL).

### 3. Run both apps

**Terminal 1 – Nest backend:**

```bash
cd backend && npm run start:dev
```

**Terminal 2 – Next.js frontend:**

```bash
npm run dev
```

With `NEXT_PUBLIC_API_URL=http://localhost:3001`, the frontend will call the Nest backend for `/api/sync`, `/api/log-error`, and (if you wire it) reports.

### 4. Optional: Use React Query hooks instead of the store

The store still owns app state and polls `/api/sync`. To move toward React Query:

- Use **`useSyncState()`** for read-only state and **`useSyncMutation()`** for actions (e.g. `RECORD_EVENT`, `ADD_CLICR`).
- Gradually replace `refreshState` and `authFetch` usage with these hooks and then remove the sync polling from the store, or keep the store and have it read from the React Query cache.

Example:

```tsx
import { useSyncState, useSyncMutation } from "@/lib/api/hooks";

function MyComponent() {
  const { data, isLoading, error, refetch } = useSyncState();
  const mutation = useSyncMutation();

  const handleRecordEvent = () => {
    mutation.mutate({ action: "RECORD_EVENT", payload: { ... } });
  };
  // ...
}
```

### 5. Actions not yet implemented in Nest

The Nest `POST /api/sync` handler implements the main actions used by the app. These **are not** implemented in Nest yet (they would need Supabase inserts/updates and possibly RLS):

- `ADD_USER`, `UPDATE_USER`, `REMOVE_USER`
- `ADD_VENUE`, `ADD_AREA`
- `UPDATE_CLICR`

You can add them in `backend/src/sync/sync.service.ts` in the `postAction` switch, following the same pattern as `ADD_CLICR` / `UPDATE_VENUE`.

### 6. Reports and log-error via Axios

- **Reports:** Use `fetchAggregateReport(businessId, date)` from `lib/api/reports.ts` or **`useAggregateReport(businessId, date)`** from `lib/api/hooks.ts` (only runs when both `businessId` and `date` are set).
- **Log errors:** The store still calls `logErrorToUsage`, which uses `fetch`. To use the Nest backend for that, ensure `NEXT_PUBLIC_API_URL` is set (the store already uses `getApiBase()` for the log-error URL). For a full Axios path, you could switch `logErrorToUsage` to use `logErrorToBackend` from `lib/api/log-error.ts`.

### 7. Production

- Run Nest on your chosen host (e.g. same server, Docker, or a separate service).
- Set `NEXT_PUBLIC_API_URL` to the public Nest URL (e.g. `https://api.yourdomain.com`).
- Set Nest `CORS_ORIGIN` to your frontend origin (e.g. `https://app.yourdomain.com`).
- Keep Supabase env vars (and service role key) only on the server; do not expose the service role key to the browser.

## Summary

| Item | Action |
|------|--------|
| Use Nest backend | Set `NEXT_PUBLIC_API_URL` and run `backend` with its `.env`. |
| Use Next.js API routes | Leave `NEXT_PUBLIC_API_URL` unset; frontend will call `/api/sync` etc. on the same origin. |
| Use React Query | Use `useSyncState`, `useSyncMutation`, `useAggregateReport` from `lib/api/hooks.ts`. |
| Add more Nest actions | Extend `postAction` in `backend/src/sync/sync.service.ts`. |
