-- File: 10_activity_logs.sql
-- Plan: 08_activity-audit-log-plan.md
-- Date: 2026-06-06
-- Status: In Progress
-- Remote migration: applied (10_activity_logs)
-- Summary: append-only activity_logs table with RLS SELECT and service_role-only INSERT

-- Plan: 08_activity-audit-log-plan.md
-- Date: 2026-06-06
-- Status: Approved

create table public.activity_logs (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  actor_display_name text,
  action text not null,
  target_type text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_label text not null,
  http_method text not null,
  http_path text not null,
  http_status smallint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_created_at
  on public.activity_logs (created_at desc);

create index if not exists idx_activity_logs_actor_created
  on public.activity_logs (actor_user_id, created_at desc);

create index if not exists idx_activity_logs_target_created
  on public.activity_logs (target_user_id, created_at desc);

create or replace function public.prevent_activity_log_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'activity_logs is append-only';
end;
$$;

create trigger trg_activity_logs_no_update
before update or delete on public.activity_logs
for each row execute function public.prevent_activity_log_mutation();

alter table public.activity_logs enable row level security;

create policy activity_logs_select_self_or_admin
on public.activity_logs for select to authenticated
using (
  actor_user_id = auth.uid()
  or target_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.system_role = 'admin'
  )
);

revoke insert, update, delete on public.activity_logs from authenticated;
revoke insert, update, delete on public.activity_logs from anon;
