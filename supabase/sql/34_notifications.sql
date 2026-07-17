-- 2026-07-16: 인앱 알림 MVP (user.update) — 테이블, RLS, Realtime publication
-- File: 34_notifications.sql
-- Plan: 27_in-app-notifications-user-update-plan.md
-- Date: 2026-07-16
-- Status: Completed
-- Remote migration: applied (34_notifications)
-- Summary: notifications 테이블 · RLS(select own/admin) · service_role CUD · Realtime INSERT

create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('user.update')),
  title text not null,
  body text not null,
  status text not null default 'unread' check (status in ('unread', 'read')),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is '사용자 인앱 알림 (MVP: user.update)';
comment on column public.notifications.metadata is 'changed_fields 등 비민감 allowlist — 필드값 저장 금지';

create index if not exists idx_notifications_recipient_created
  on public.notifications (recipient_user_id, created_at desc, id desc);

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_user_id, created_at desc)
  where status = 'unread';

alter table public.notifications enable row level security;

create policy notifications_select_own_or_admin
on public.notifications for select to authenticated
using (
  recipient_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.system_role = 'admin'
  )
);

revoke insert, update, delete on public.notifications from authenticated;
revoke insert, update, delete on public.notifications from anon;

alter table public.notifications replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
