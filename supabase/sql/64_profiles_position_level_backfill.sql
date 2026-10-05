-- File: 64_profiles_position_level_backfill.sql
-- Plan: 63_org-chart-admin-profile-plan.md (legacy data)
-- Date: 2026-10-05
-- Status: Superseded
-- Summary: 임시 백필(전원 사원/매니저/오퍼레이터) — **65_profiles_org_chart_reference_seed.sql** 로 대체됨

-- wake: 경영진 rank 제외 → 사원
update public.profiles
set position_level = '사원'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and position_level is null
  and rank is not null
  and rank <> '경영진';

-- sans → 매니저
update public.profiles
set position_level = '매니저'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and position_level is null;

-- sans_foundry: rank=공장장 → 공장장
update public.profiles
set position_level = '공장장'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans_foundry'
  and position_level is null
  and rank = '공장장';

-- sans_foundry: 그 외 팀 → 오퍼레이터
update public.profiles
set position_level = '오퍼레이터'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans_foundry'
  and position_level is null
  and (rank is null or rank <> '공장장');

-- wake rank=경영진: CEO/COO는 Users에서 수동 설정 (자동 백필 제외)
