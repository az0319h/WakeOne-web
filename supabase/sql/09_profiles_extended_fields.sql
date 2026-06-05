-- File: 09_profiles_extended_fields.sql
-- Plan: 05_profile-completion-plan.md
-- Date: 2026-06-05
-- Status: In Progress
-- Remote migration: applied (09_profiles_extended_fields)
-- Summary: avatar_url, affiliation, department, rank, job_title, food_restrictions on profiles

-- Plan: 05_profile-completion-plan.md
-- Date: 2026-06-05
-- Status: Approved

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists affiliation text check (affiliation in ('wake', 'sans', 'sans_foundry')),
  add column if not exists department text,
  add column if not exists rank text,
  add column if not exists job_title text,
  add column if not exists food_restrictions text;

alter table public.profiles
  add constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048),
  add constraint profiles_rank_length check (rank is null or char_length(rank) <= 50),
  add constraint profiles_job_title_length check (job_title is null or char_length(job_title) <= 50),
  add constraint profiles_food_restrictions_length check (food_restrictions is null or char_length(food_restrictions) <= 200);

comment on column public.profiles.avatar_url is '프로필 이미지 URL (admin 설정)';
comment on column public.profiles.affiliation is '소속: wake|sans|sans_foundry';
comment on column public.profiles.department is '부서/지점 (admin 설정, 소속별 enum)';
comment on column public.profiles.rank is '직급 (admin 설정)';
comment on column public.profiles.job_title is '직책/역할명 (admin 설정)';
comment on column public.profiles.food_restrictions is '못 먹는 음식 (본인 입력, max 200자)';
