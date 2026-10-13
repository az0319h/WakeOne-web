-- 2026-10-11: reusable E2E 계정의 조직도 오염 복구
-- File: 75_e2e_fixture_profile_reset.sql
-- Plan: verifier Step 7 follow-up
-- Status: Completed
-- Remote migration: applied (e2e_fixture_profile_reset)
-- Summary: 계정은 보존하되 E2E가 변경한 조직도 필드를 기준값으로 되돌리고 잔존을 검증한다.

create or replace function public.reset_e2e_fixture_profiles()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_org_chart_profiles integer := 0;
begin
  update public.profiles
  set full_name = case email
        when '1234@naver.com' then '테스트 계정1'
        when '4321@naver.com' then '테스트 계정2'
        else full_name
      end,
      status = 'active',
      deactivated_at = null,
      system_role = 'user',
      affiliation = 'wake',
      rank = '경영진',
      position_level = null,
      leader_role = null,
      avatar_url = case
        when avatar_url ilike '%e2e-%' then null
        else avatar_url
      end,
      updated_at = now()
  where email in ('1234@naver.com', '4321@naver.com');

  update public.profiles
  set full_name = '관리자',
      status = 'active',
      deactivated_at = null,
      system_role = 'admin',
      affiliation = null,
      rank = null,
      position_level = null,
      leader_role = null,
      updated_at = now()
  where email = 'wakeone.ops@gmail.com';

  select count(*)
  into remaining_org_chart_profiles
  from public.profiles
  where email in ('1234@naver.com', '4321@naver.com', 'wakeone.ops@gmail.com')
    and (
      position_level is not null
      or leader_role is not null
      or (email = 'wakeone.ops@gmail.com' and (affiliation is not null or rank is not null))
    );

  return jsonb_build_object(
    'remaining', jsonb_build_object(
      'fixture_org_chart_profiles', remaining_org_chart_profiles
    )
  );
end;
$$;

revoke all on function public.reset_e2e_fixture_profiles() from public;
grant execute on function public.reset_e2e_fixture_profiles() to service_role;
