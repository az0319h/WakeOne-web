-- File: 65_profiles_org_chart_reference_seed.sql
-- Plan: 63_org-chart-admin-profile-plan.md
-- Date: 2026-10-05
-- Status: Approved
-- Remote migration: applied (65_profiles_org_chart_reference_seed)
-- Summary: 참조 조직도 이미지(웨이크·산스·산스파운드리) 기준 position_level·leader_role 시드 — SQL 64 일괄 백필 덮어쓰기

-- SQL 64는 position_level NULL → 소속별 단일 기본값(사원/매니저/오퍼레이터)만 채워
-- 참조 이미지의 개인별 직급·T/P를 반영하지 못함. 본 파일로 active user만 정확히 덮어씀.
-- WakeOne에 없는 인원(조성철·김은비 inactive 등)은 추가/활성화하지 않음.

-- ── wake: 경영진 ─────────────────────────────────────────────
update public.profiles
set position_level = 'CEO',
    leader_role = null,
    rank = '경영진'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '김경훈';

update public.profiles
set position_level = 'COO',
    leader_role = null,
    rank = '경영진'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '이준상';

-- ── wake: 사업기획팀 ─────────────────────────────────────────
update public.profiles
set position_level = '대리',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and rank = '사업기획팀'
  and full_name in ('김태린', '김주원');

-- ── wake: 마케팅팀 ───────────────────────────────────────────
update public.profiles
set position_level = '과장',
    leader_role = 'team_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '박선재';

update public.profiles
set position_level = '대리',
    leader_role = 'part_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and rank = '마케팅팀'
  and full_name in ('김동은', '김다은', '한상완');

-- ── wake: 디자인팀 ───────────────────────────────────────────
update public.profiles
set position_level = '대리',
    leader_role = 'team_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '문현진';

update public.profiles
set position_level = '과장',
    leader_role = 'part_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '홍윤의';

update public.profiles
set position_level = '대리',
    leader_role = 'part_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '정연재';

update public.profiles
set position_level = '주임',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '홍성빈';

-- ── wake: 구매물류팀 ─────────────────────────────────────────
update public.profiles
set position_level = '차장',
    leader_role = 'team_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '오신영';

-- ── wake: 인사팀 ─────────────────────────────────────────────
update public.profiles
set position_level = '과장',
    leader_role = 'team_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '김아영';

update public.profiles
set position_level = '주임',
    leader_role = 'part_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '이혜빈';

update public.profiles
set position_level = '사원',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '홍성훈';

-- ── wake: 회계팀 ─────────────────────────────────────────────
update public.profiles
set position_level = '대리',
    leader_role = 'part_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'wake'
  and full_name = '김민정';

-- ── sans ─────────────────────────────────────────────────────
update public.profiles
set position_level = '부점장',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and full_name = '백수진';

update public.profiles
set position_level = '선임매니저',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and full_name = '김도형';

update public.profiles
set position_level = '쉐프',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and full_name = '이나겸';

update public.profiles
set position_level = '매니저',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and full_name = '이재강';

update public.profiles
set position_level = '점장',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and full_name = '김도연';

update public.profiles
set position_level = '매니저',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and full_name = '임효현';

-- ── sans_foundry ─────────────────────────────────────────────
update public.profiles
set position_level = '공장장',
    leader_role = null,
    rank = '공장장'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans_foundry'
  and full_name = '유동욱';

update public.profiles
set position_level = '팀장',
    leader_role = 'team_leader'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans_foundry'
  and full_name in ('한승우', '맹갑열', '정진용', '이성하', '김영문');

update public.profiles
set position_level = '차장',
    leader_role = null
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans_foundry'
  and full_name = '김각기';
