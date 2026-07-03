-- 2026-07-03: 계약서 관리 스키마 및 Storage bucket 추가
-- File: 17_contract_management.sql
-- Plan: 16_contract-management-plan.md
-- Date: 2026-07-03
-- Status: In Progress
-- Remote migration: failed (MCP connection timeout before history table initialization)
-- Summary: contract documents, attachments, import events, private storage bucket, indexes, triggers, and admin-only RLS

create table if not exists public.contract_documents (
  id bigint generated always as identity primary key,
  document_number text not null,
  document_created_at date not null,
  author_user_id uuid references auth.users(id) on delete set null,
  author_email text,
  author_name text not null,
  contract_target text not null,
  contract_summary text not null,
  amount numeric(14, 0) check (amount is null or amount >= 0),
  contract_start_date date,
  contract_end_date date,
  notes text,
  no_attachment_required boolean not null default false,
  no_attachment_reason text,
  status text not null default 'active' check (status in ('active', 'soft_deleted')),
  source_type text not null default 'openclaw_gmail',
  source_message_id text,
  source_thread_id text,
  source_mail_subject text,
  source_document_url text,
  external_document_id text,
  external_payload jsonb,
  imported_at timestamptz,
  synced_at timestamptz,
  created_by_id uuid references auth.users(id) on delete set null,
  updated_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contract_documents_document_number_key unique (document_number),
  constraint contract_documents_document_number_length_check check (char_length(document_number) <= 100),
  constraint contract_documents_author_email_length_check check (author_email is null or char_length(author_email) <= 320),
  constraint contract_documents_author_name_length_check check (char_length(author_name) <= 200),
  constraint contract_documents_contract_target_length_check check (char_length(contract_target) <= 300),
  constraint contract_documents_contract_summary_length_check check (char_length(contract_summary) <= 2000),
  constraint contract_documents_notes_length_check check (notes is null or char_length(notes) <= 4000),
  constraint contract_documents_no_attachment_reason_length_check check (
    no_attachment_reason is null or char_length(no_attachment_reason) <= 500
  )
);

create unique index if not exists idx_contract_documents_source_message_unique
  on public.contract_documents (source_message_id)
  where source_message_id is not null;

create index if not exists idx_contract_documents_created_at
  on public.contract_documents (document_created_at desc);

create index if not exists idx_contract_documents_status
  on public.contract_documents (status);

create index if not exists idx_contract_documents_author_email
  on public.contract_documents (author_email);

create index if not exists idx_contract_documents_no_attachment_required
  on public.contract_documents (no_attachment_required);

drop trigger if exists trg_contract_documents_updated_at on public.contract_documents;
create trigger trg_contract_documents_updated_at
before update on public.contract_documents
for each row
execute function public.set_updated_at();

create table if not exists public.contract_attachments (
  id bigint generated always as identity primary key,
  contract_id bigint not null references public.contract_documents(id) on delete restrict,
  file_name text not null,
  storage_bucket text not null default 'contract-attachments',
  storage_path text not null,
  content_type text,
  file_size integer not null check (file_size > 0 and file_size <= 1048576),
  status text not null default 'active' check (status in ('active', 'soft_deleted')),
  uploaded_by_id uuid references auth.users(id) on delete set null,
  deleted_by_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contract_attachments_file_name_length_check check (char_length(file_name) <= 255),
  constraint contract_attachments_storage_path_key unique (storage_path),
  constraint contract_attachments_contract_file_name_key unique (contract_id, file_name)
);

create index if not exists idx_contract_attachments_contract
  on public.contract_attachments (contract_id);

create index if not exists idx_contract_attachments_status
  on public.contract_attachments (status);

create table if not exists public.contract_import_events (
  id bigint generated always as identity primary key,
  request_id uuid,
  source_message_id text,
  document_number text,
  status text not null check (status in ('created', 'duplicate', 'failed')),
  error_code text,
  error_message text,
  received_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint contract_import_events_error_message_length_check check (
    error_message is null or char_length(error_message) <= 500
  )
);

create index if not exists idx_contract_import_events_created_at
  on public.contract_import_events (created_at desc);

create index if not exists idx_contract_import_events_document_number
  on public.contract_import_events (document_number);

create index if not exists idx_contract_import_events_source_message
  on public.contract_import_events (source_message_id);

alter table public.contract_documents enable row level security;
alter table public.contract_attachments enable row level security;
alter table public.contract_import_events enable row level security;

drop policy if exists contract_documents_admin_select on public.contract_documents;
create policy contract_documents_admin_select
on public.contract_documents
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

drop policy if exists contract_attachments_admin_select on public.contract_attachments;
create policy contract_attachments_admin_select
on public.contract_attachments
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

drop policy if exists contract_import_events_admin_select on public.contract_import_events;
create policy contract_import_events_admin_select
on public.contract_import_events
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

revoke insert, update, delete on public.contract_documents from authenticated;
revoke insert, update, delete on public.contract_documents from anon;
revoke insert, update, delete on public.contract_attachments from authenticated;
revoke insert, update, delete on public.contract_attachments from anon;
revoke insert, update, delete on public.contract_import_events from authenticated;
revoke insert, update, delete on public.contract_import_events from anon;

insert into storage.buckets (id, name, public, file_size_limit)
values ('contract-attachments', 'contract-attachments', false, 1048576)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists contract_attachments_storage_admin_select on storage.objects;
create policy contract_attachments_storage_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'contract-attachments'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.system_role = 'admin'
  )
);
