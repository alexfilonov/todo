create extension if not exists pgcrypto;

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('canvas', 'gradescope_via_canvas')),
  source_id text not null,
  course_id text not null,
  course_name text,
  title text not null,
  description text,
  due_at timestamptz,
  html_url text,
  points_possible numeric,
  status text not null default 'active' check (status in ('active', 'deleted')),
  raw jsonb,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create table if not exists google_task_links (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  task_list_id text not null,
  google_task_id text not null,
  etag text,
  last_synced_at timestamptz not null default now(),
  unique (assignment_id),
  unique (task_list_id, google_task_id)
);

create table if not exists oauth_tokens (
  provider text primary key check (provider in ('canvas', 'google')),
  access_token text not null,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed')),
  fetched_count integer default 0,
  upserted_count integer default 0,
  deleted_count integer default 0,
  error text
);

create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_due_at on assignments(due_at);
create index if not exists idx_assignments_course_id on assignments(course_id);
create index if not exists idx_assignments_updated_at on assignments(updated_at);
