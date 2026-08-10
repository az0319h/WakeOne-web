-- 2026-08-10: 공지사항 테이블·첨부·Storage bucket·RLS
-- File: 41_announcements.sql
-- Plan: 39_announcements-plan.md
-- Date: 2026-08-10
-- Status: Completed
-- Remote migration: applied via MCP (2026-08-10)
-- Summary: announcements · announcement_attachments · announcement-attachments bucket · authenticated SELECT · service_role CUD

create table public.announcements (
  id bigint generated always as identity primary key,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  priority text not null default 'normal'
    check (priority in ('normal', 'important', 'urgent')),
  is_pinned boolean not null default false,
  created_by uuid not null references auth.users(id),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is '전사 공지사항 (plan 39)';
comment on column public.announcements.notified_at is 'fan-out 완료 시각 — NULL이면 미발송';

create table public.announcement_attachments (
  id bigint generated always as identity primary key,
  announcement_id bigint not null references public.announcements(id) on delete cascade,
  file_name text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  content_type text,
  storage_path text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint announcement_attachments_file_name_length_check check (char_length(file_name) <= 255),
  constraint announcement_attachments_storage_path_key unique (storage_path),
  constraint announcement_attachments_announcement_file_name_key unique (announcement_id, file_name)
);

create index idx_announcements_list
  on public.announcements (is_pinned desc, created_at desc, id desc);

create index idx_announcement_attachments_announcement
  on public.announcement_attachments (announcement_id, created_at desc);

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
before update on public.announcements
for each row
execute function public.set_updated_at();

alter table public.announcements enable row level security;
alter table public.announcement_attachments enable row level security;

drop policy if exists announcements_authenticated_select on public.announcements;
create policy announcements_authenticated_select
on public.announcements
for select
to authenticated
using (true);

drop policy if exists announcement_attachments_authenticated_select on public.announcement_attachments;
create policy announcement_attachments_authenticated_select
on public.announcement_attachments
for select
to authenticated
using (true);

revoke insert, update, delete on public.announcements from authenticated;
revoke insert, update, delete on public.announcements from anon;
revoke insert, update, delete on public.announcement_attachments from authenticated;
revoke insert, update, delete on public.announcement_attachments from anon;

insert into storage.buckets (id, name, public, file_size_limit)
values ('announcement-attachments', 'announcement-attachments', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists announcement_attachments_storage_authenticated_select on storage.objects;
create policy announcement_attachments_storage_authenticated_select
on storage.objects
for select
to authenticated
using (bucket_id = 'announcement-attachments');
