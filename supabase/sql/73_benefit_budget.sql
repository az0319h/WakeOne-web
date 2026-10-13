-- File: 73_benefit_budget.sql
-- Plan: benefit-budget-automation
-- Date: 2026-10-11
-- Status: Completed
-- Remote migration: applied (benefit_budget)
-- Summary: approved Flex benefit documents, import events, indexes, and RLS

create table if not exists public.benefit_documents (
  id bigint generated always as identity primary key,
  document_number text not null,
  task_key text not null,
  benefit_type text not null check (benefit_type in ('book', 'fitness', 'education')),
  document_created_at date not null,
  approved_at timestamptz not null,
  applicant_user_id uuid not null references auth.users(id) on delete restrict,
  applicant_name text not null,
  amount numeric(14, 0) not null check (amount >= 0),
  description text,
  source_document_url text not null,
  source_message_id text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benefit_documents_document_number_key unique (document_number),
  constraint benefit_documents_task_key_key unique (task_key),
  constraint benefit_documents_document_number_length_check check (char_length(document_number) <= 100),
  constraint benefit_documents_task_key_length_check check (char_length(task_key) <= 200),
  constraint benefit_documents_applicant_name_length_check check (char_length(applicant_name) <= 200),
  constraint benefit_documents_description_length_check check (
    description is null or char_length(description) <= 500
  ),
  constraint benefit_documents_source_url_length_check check (char_length(source_document_url) <= 1000),
  constraint benefit_documents_source_message_length_check check (
    source_message_id is null or char_length(source_message_id) <= 200
  )
);

create unique index if not exists idx_benefit_documents_source_message_unique
  on public.benefit_documents (source_message_id)
  where source_message_id is not null;

create index if not exists idx_benefit_documents_user_month
  on public.benefit_documents (applicant_user_id, document_created_at desc);

create index if not exists idx_benefit_documents_month_type
  on public.benefit_documents (document_created_at desc, benefit_type);

drop trigger if exists trg_benefit_documents_updated_at on public.benefit_documents;
create trigger trg_benefit_documents_updated_at
before update on public.benefit_documents
for each row
execute function public.set_updated_at();

create table if not exists public.benefit_import_events (
  id bigint generated always as identity primary key,
  request_id uuid,
  document_number text,
  task_key text,
  status text not null check (status in ('created', 'duplicate', 'failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint benefit_import_events_error_message_length_check check (
    error_message is null or char_length(error_message) <= 500
  )
);

create index if not exists idx_benefit_import_events_created_at
  on public.benefit_import_events (created_at desc);

create index if not exists idx_benefit_import_events_document
  on public.benefit_import_events (document_number);

alter table public.benefit_documents enable row level security;
alter table public.benefit_import_events enable row level security;

drop policy if exists benefit_documents_admin_select on public.benefit_documents;
create policy benefit_documents_admin_select
on public.benefit_documents
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
      and p.status = 'active'
  )
);

drop policy if exists benefit_documents_self_select on public.benefit_documents;
create policy benefit_documents_self_select
on public.benefit_documents
for select
to authenticated
using (applicant_user_id = auth.uid());

drop policy if exists benefit_import_events_admin_select on public.benefit_import_events;
create policy benefit_import_events_admin_select
on public.benefit_import_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
      and p.status = 'active'
  )
);

revoke insert, update, delete on public.benefit_documents from authenticated, anon;
revoke insert, update, delete on public.benefit_import_events from authenticated, anon;
