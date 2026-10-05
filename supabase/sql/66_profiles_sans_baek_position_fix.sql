-- File: 66_profiles_sans_baek_position_fix.sql
-- Plan: 63_org-chart-admin-profile-plan.md
-- Date: 2026-10-05
-- Status: Approved
-- Remote migration: applied (66_profiles_sans_baek_position_fix)
-- Summary: 익선 백수진 직급 점장 → 부점장 (참조 조직도·직급 규칙)

update public.profiles
set position_level = '부점장'
where status = 'active'
  and system_role = 'user'
  and affiliation = 'sans'
  and rank = '익선'
  and full_name = '백수진';
