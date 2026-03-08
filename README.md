# Deadline Aggregate

Single-user backend service that syncs UC Berkeley Canvas assignment deadlines (including Gradescope-linked Canvas assignments) into Google Tasks.

## What this MVP does

- Connect Canvas via Personal Access Token (or OAuth) and Google via OAuth.
- Fetch active Canvas courses and assignments.
- Classify external-tool assignments linked to Gradescope as `gradescope_via_canvas`.
- Upsert assignments into Supabase.
- Create/update tasks in a dedicated Google Task list.
- Mark removed assignments deleted and either delete/complete corresponding Google Tasks.
- Provide manual sync + status + assignment query endpoints.

## Stack

- Node.js + TypeScript + Express
- Supabase (Postgres)
- Canvas API
- Google Tasks API

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and fill values:

```bash
cp .env.example .env
```

3. Run SQL migration in Supabase:

- File: `supabase/migrations/001_init.sql`

4. Start dev server:

```bash
npm run dev
```

## Render deploy

This repo includes `render.yaml` with:

- `caltodo-api` web service
- `caltodo-weekly-sync` cron job (weekly Monday 02:00 UTC)

Deploy with Render Blueprint and set secret env vars:

- `PUBLIC_BASE_URL` (your Render app URL, e.g. `https://caltodo-api.onrender.com`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CANVAS_ACCESS_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_TOKEN`

After deploy, update Google OAuth redirect URI to:

- `{PUBLIC_BASE_URL}/api/auth/google/callback`

Then reconnect Google using:

- `{PUBLIC_BASE_URL}/api/auth/google/start`

## Frontend (Next.js)

A simple dashboard UI is available in `/frontend`.

Local run:

```bash
cd frontend
npm install
cp .env.example .env.local
# set BACKEND_BASE_URL and BACKEND_ADMIN_TOKEN
npm run dev
```

Recommended deploy:

- Deploy `/frontend` to Vercel.
- Set env vars in Vercel:
  - `BACKEND_BASE_URL` (e.g. `https://caltodo-api.onrender.com`)
  - `BACKEND_ADMIN_TOKEN` (same value as backend `ADMIN_TOKEN`)
  - `FRONTEND_AUTH_PASSWORD` (dashboard login password)
  - `FRONTEND_AUTH_SECRET` (random secret used to sign auth session cookie)

## Canvas auth modes

### Recommended (student-friendly): Personal Access Token

1. In bCourses: `Account -> Settings`.
2. Click `+ New Access Token`.
3. Copy token and set `CANVAS_ACCESS_TOKEN` in `.env`.

No Canvas OAuth app is required in this mode.

### Optional: Canvas OAuth app

If you have Canvas admin/developer access, set:

- `CANVAS_CLIENT_ID`
- `CANVAS_CLIENT_SECRET`

and use callback:

- `{PUBLIC_BASE_URL}/api/auth/canvas/callback`

## OAuth callback URLs

Set these in your OAuth app settings:

- Google callback: `{PUBLIC_BASE_URL}/api/auth/google/callback`

Example local:

- `http://localhost:3000/api/auth/google/callback`

## API endpoints

- `GET /api/health`
- `GET /api/auth/canvas/start`
- `GET /api/auth/canvas/callback`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/sync/run`
- `GET /api/sync/status`
- `GET /api/assignments?courseId=&from=&to=&status=`
- `PATCH /api/config`
- `POST /api/tasks/reconcile`

If `ADMIN_TOKEN` is set, send it as `x-admin-token` on mutating endpoints.

## Notes

- This is intentionally single-user; no user table/auth layer.
- Tokens are stored in `oauth_tokens` as plain text for MVP speed. Add encryption before production.
- Scheduled sync runs every `SYNC_INTERVAL_MINUTES`.
- `INTERNAL_SCHEDULER_ENABLED=false` disables in-process interval sync (recommended when using external cron like Render).
- If `CANVAS_ACCESS_TOKEN` is set, Canvas OAuth endpoints are disabled and Canvas uses the static token.
- By default, only upcoming assignments are synced (`HIDE_PAST_DUE=true`).
- Assignments without a due date are skipped.
