-- File: 06_profile_status_by_email_rpc.sql
-- Plan: 03_user-lifecycle-profile-plan.md
-- Date: 2026-06-05
-- Summary: 로그인 전 이메일로 profiles.status 조회 (비활성 계정 선차단)

create or replace function public.profile_status_for_email(p_email text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.status
  from public.profiles p
  where lower(p.email) = lower(trim(p_email))
  limit 1;
$$;

comment on function public.profile_status_for_email(text) is
  '로그인 API 호출 전 inactive 여부 확인. ban된 계정도 비활성 메시지를 반환하기 위함.';

revoke all on function public.profile_status_for_email(text) from public;
grant execute on function public.profile_status_for_email(text) to anon;
grant execute on function public.profile_status_for_email(text) to authenticated;
