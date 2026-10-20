-- 2026-10-18: plan 81 — google_tasks_connections schema align + legacy row wipe
-- File: 83_google_tasks_connections.sql
-- Plan: 81_kanban-google-tasks-plan.md
-- Date: 2026-10-18
-- Status: Completed
-- Remote migration: 83_google_tasks_connections (apply via MCP)
-- Summary: Legacy OAuth connection rows wiped. Column set aligned to login-callback
--          encrypted refresh token storage (encrypted_refresh_token, token_updated_at, created_at).
--          RLS: authenticated SELECT own row only; mutations via service role Route Handlers.

-- Legacy plan 52/54 connections (separate OAuth) — full wipe on deploy.
delete from public.google_tasks_connections;

alter table public.google_tasks_connections
  drop column if exists refresh_token_enc,
  drop column if exists access_token,
  drop column if exists access_expires_at,
  drop column if exists scopes,
  drop column if exists connected_at,
  drop column if exists updated_at;

alter table public.google_tasks_connections
  add column if not exists encrypted_refresh_token text,
  add column if not exists token_updated_at timestamptz,
  add column if not exists created_at timestamptz default now();

update public.google_tasks_connections
set
  token_updated_at = coalesce(token_updated_at, now()),
  created_at = coalesce(created_at, now())
where token_updated_at is null or created_at is null;

alter table public.google_tasks_connections
  alter column encrypted_refresh_token set not null,
  alter column token_updated_at set not null,
  alter column created_at set not null;

comment on table public.google_tasks_connections is
  'Google Tasks refresh token (encrypted) per WakeOne user — login OAuth callback upsert. plan 81';
comment on column public.google_tasks_connections.encrypted_refresh_token is
  'AES-GCM encrypted provider refresh token — server decrypt only';
comment on column public.google_tasks_connections.token_updated_at is
  'Last refresh token upsert from Google login callback';

alter table public.google_tasks_connections enable row level security;

drop policy if exists google_tasks_connections_select_own on public.google_tasks_connections;
create policy google_tasks_connections_select_own
  on public.google_tasks_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
