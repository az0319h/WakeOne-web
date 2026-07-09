-- Plan: 19_user-single-name-plan.md
-- Date: 2026-07-09
-- Status: Approved

alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
where full_name is null;

update public.profiles
set full_name = email
where full_name is null or btrim(full_name) = '';

alter table public.profiles
  add constraint profiles_full_name_length check (char_length(full_name) <= 100);

alter table public.profiles
  alter column full_name set not null;

alter table public.profiles
  alter column first_name drop not null,
  alter column last_name drop not null;

comment on column public.profiles.full_name is '사용자 이름(단일 필드). first_name/last_name은 deprecated — 앱 레이어 미참조, 후속 plan에서 DROP 검토';
comment on column public.profiles.first_name is 'deprecated — full_name으로 대체. 앱 레이어 참조 금지';
comment on column public.profiles.last_name is 'deprecated — full_name으로 대체. 앱 레이어 참조 금지';
