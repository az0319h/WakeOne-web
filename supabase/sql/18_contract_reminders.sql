-- 2026-07-03: 계약서 첨부 누락 독촉 run/recipient 이력 추가
-- File: 18_contract_reminders.sql
-- Plan: 16_contract-management-plan.md
-- Date: 2026-07-03
-- Status: Completed
-- Remote migration: applied (18_contract_reminders)
-- Summary: weekly contract reminder run idempotency and per-recipient delivery result tables

create table if not exists public.contract_reminder_runs (
  id bigint generated always as identity primary key,
  run_key text not null,
  request_id uuid not null,
  trigger_source text not null default 'admin' check (trigger_source in ('admin', 'cron')),
  triggered_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'failed' check (status in ('completed', 'partial_failed', 'failed')),
  target_count integer not null default 0 check (target_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint contract_reminder_runs_run_key_key unique (run_key),
  constraint contract_reminder_runs_run_key_length_check check (char_length(run_key) <= 80)
);

create index if not exists idx_contract_reminder_runs_created_at
  on public.contract_reminder_runs (created_at desc);

create index if not exists idx_contract_reminder_runs_status
  on public.contract_reminder_runs (status);

create table if not exists public.contract_reminder_recipients (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.contract_reminder_runs(id) on delete cascade,
  recipient_email text not null,
  author_name text not null,
  contract_ids bigint[] not null default '{}',
  document_numbers text[] not null default '{}',
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contract_reminder_recipients_run_email_key unique (run_id, recipient_email),
  constraint contract_reminder_recipients_email_length_check check (char_length(recipient_email) <= 320),
  constraint contract_reminder_recipients_author_name_length_check check (char_length(author_name) <= 200),
  constraint contract_reminder_recipients_error_message_length_check check (
    error_message is null or char_length(error_message) <= 500
  )
);

create index if not exists idx_contract_reminder_recipients_run
  on public.contract_reminder_recipients (run_id);

create index if not exists idx_contract_reminder_recipients_email
  on public.contract_reminder_recipients (recipient_email);

create index if not exists idx_contract_reminder_recipients_status
  on public.contract_reminder_recipients (status);

alter table public.contract_reminder_runs enable row level security;
alter table public.contract_reminder_recipients enable row level security;

drop policy if exists contract_reminder_runs_admin_select on public.contract_reminder_runs;
create policy contract_reminder_runs_admin_select
on public.contract_reminder_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

drop policy if exists contract_reminder_recipients_admin_select on public.contract_reminder_recipients;
create policy contract_reminder_recipients_admin_select
on public.contract_reminder_recipients
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);

revoke insert, update, delete on public.contract_reminder_runs from authenticated;
revoke insert, update, delete on public.contract_reminder_runs from anon;
revoke insert, update, delete on public.contract_reminder_recipients from authenticated;
revoke insert, update, delete on public.contract_reminder_recipients from anon;
