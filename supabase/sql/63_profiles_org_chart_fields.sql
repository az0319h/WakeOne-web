-- File: 63_profiles_org_chart_fields.sql
-- Plan: 63_org-chart-admin-profile-plan.md
-- Date: 2026-10-05
-- Status: Completed
-- Remote migration: applied (63_profiles_org_chart_fields)
-- Summary: position_level, leader_role on profiles for org chart

-- 2026-10-05: 조직도 직급·리더 역할 필드 추가 (plan 63)

alter table public.profiles
  add column if not exists position_level text,
  add column if not exists leader_role text;

alter table public.profiles
  add constraint profiles_position_level_length
    check (position_level is null or char_length(position_level) <= 50),
  add constraint profiles_leader_role_check
    check (leader_role is null or leader_role in ('team_leader', 'part_leader'));

comment on column public.profiles.position_level is '직급 (소속별 enum — user 필수, admin null)';
comment on column public.profiles.leader_role is '리더 역할: team_leader(T) | part_leader(P) | null';
