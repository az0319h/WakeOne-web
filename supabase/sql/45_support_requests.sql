-- 2026-08-18: CS 문의 support_requests 테이블 · RLS (plan 42)
-- File: 45_support_requests.sql
-- Plan: 42_cs-support-plan.md
-- Date: 2026-08-18
-- Status: Approved
-- Summary: support_requests · user own SELECT · admin all SELECT · Route service_role CUD

create table public.support_requests (
  id bigint generated always as identity primary key,
  submitted_by uuid not null references auth.users(id),
  submitter_name text not null,
  submitter_email text not null,
  title text not null check (char_length(trim(title)) >= 2),
  body text not null check (char_length(trim(body)) >= 10),
  status text not null default 'pending'
    check (status in ('pending', 'received', 'completed')),
  status_updated_at timestamptz,
  status_updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_requests is 'CS 문의 (plan 42)';
comment on column public.support_requests.submitter_name is 'create 시 profiles.full_name 스냅샷';
comment on column public.support_requests.submitter_email is 'create 시 profiles.email 스냅샷';

create index idx_support_requests_user_list
  on public.support_requests (submitted_by, created_at desc, id desc);

create index idx_support_requests_admin_list
  on public.support_requests (status, created_at desc, id desc);

drop trigger if exists trg_support_requests_updated_at on public.support_requests;
create trigger trg_support_requests_updated_at
before update on public.support_requests
for each row
execute function public.set_updated_at();

alter table public.support_requests enable row level security;

drop policy if exists support_requests_select_own_or_admin on public.support_requests;
create policy support_requests_select_own_or_admin
on public.support_requests
for select
to authenticated
using (
  submitted_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.system_role = 'admin'
  )
);

revoke insert, update, delete on public.support_requests from authenticated;
revoke insert, update, delete on public.support_requests from anon;
