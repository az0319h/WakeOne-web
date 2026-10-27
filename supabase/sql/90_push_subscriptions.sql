-- 2026-10-22: plan 91 — PWA 웹 푸시: push_subscriptions(기기별 Web Push 구독) · push_notification_preferences(사용자별 끈 그룹)
-- File: 90_push_subscriptions.sql
-- Plan: 91_pwa-web-push-notifications-plan.md
-- Date: 2026-10-22
-- Status: Completed
-- Remote migration: 90_push_subscriptions — dev 적용 (WakeOne-Dev-Supabase-Mcp apply_migration) · Main 미적용
-- Summary: push_subscriptions (endpoint unique · user_id FK cascade · last_used_at)
--          push_notification_preferences (user_id PK · disabled_groups text[] · 9그룹 CHECK = push-groups.ts와 동일 목록)
--          RLS SELECT 본인만 · 쓰기는 service_role(Route Handler)만 (authenticated/anon INSERT·UPDATE·DELETE revoke)
--          Realtime publication 추가 없음 · trigger 없음(비활성화 purge는 Route 코드)

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
comment on table public.push_subscriptions is 'Web Push 구독 (기기 1대 = 1행). endpoint는 비밀값에 준함 — 로그·metadata에 전체 저장 금지. plan 91';
create index idx_push_subscriptions_user on public.push_subscriptions (user_id);

create table public.push_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  disabled_groups text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint push_notification_preferences_groups_check check (
    disabled_groups <@ array[
      'profile','users','contract','wallet','announcement',
      'support','benefit','workflow','quick_request'
    ]::text[]
  )
);
comment on table public.push_notification_preferences is '푸시 그룹 설정. 행 없음 = 전부 ON. plan 91';

alter table public.push_subscriptions enable row level security;
alter table public.push_notification_preferences enable row level security;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_notification_preferences_select_own on public.push_notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete on public.push_subscriptions from authenticated, anon;
revoke insert, update, delete on public.push_notification_preferences from authenticated, anon;
