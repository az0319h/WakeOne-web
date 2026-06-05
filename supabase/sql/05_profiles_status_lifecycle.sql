-- File: 05_profiles_status_lifecycle.sql
-- Plan: 03_user-lifecycle-profile-plan.md
-- Date: 2026-06-04
-- Status: Approved (apply via Supabase MCP / CLI before implementation verify)
-- Summary: profiles.status(active|inactive), deactivated_at, email normalize helper

-- ---------------------------------------------------------------------------
-- profiles.status + deactivated_at
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));

alter table public.profiles
  add column if not exists deactivated_at timestamptz;

comment on column public.profiles.status is
  'active: 정상 이용. inactive: 비활성(소프트 딜리트), 로그인·대시보드 차단.';

comment on column public.profiles.deactivated_at is
  '비활성화 시각. status=active 이면 NULL.';

-- 기존 행 백필
update public.profiles
set status = 'active', deactivated_at = null
where status is null or deactivated_at is distinct from null and status = 'active';

-- ---------------------------------------------------------------------------
-- 이메일 case-insensitive UNIQUE (plan 03 인터뷰 In)
-- 적용 전: select lower(email), count(*) from profiles group by 1 having count(*) > 1;
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email));
