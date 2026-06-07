-- File: 11_profiles_phone_birthday.sql
-- Plan: 09_profile-phone-birthday-plan.md
-- Date: 2026-06-07
-- Status: Completed
-- Remote migration: applied (11_profiles_phone_birthday)
-- Summary: birthday date column, profiles_phone_format NOT VALID check

-- Plan: 09_profile-phone-birthday-plan.md
-- Date: 2026-06-07
-- Status: Approved

alter table public.profiles
  add column if not exists birthday date;

comment on column public.profiles.birthday is '생일 (날짜만, nullable)';

-- 기존 invalid phone 행이 있을 수 있으므로 NOT VALID로 추가 후 운영에서 정리
alter table public.profiles
  add constraint profiles_phone_format check (
    phone is null or phone ~ '^\d{11}$'
  ) not valid;

-- invalid row 정리 후 (선택): alter table public.profiles validate constraint profiles_phone_format;
