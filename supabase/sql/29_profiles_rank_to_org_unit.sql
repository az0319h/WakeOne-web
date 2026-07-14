-- 2026-07-14: profiles.rank 직급 → 부서/사업장(조직) 일괄 변경
-- File: 29_profiles_rank_to_org_unit.sql
-- Date: 2026-07-14
-- Status: Completed
-- Remote migration: applied (29_profiles_rank_to_org_unit)
-- Summary: active 사용자 email 기준 rank를 조직 단위로 마이그레이션 (inactive·shcho@wakecorp.com 제외)

update public.profiles p
set
  rank = m.new_rank,
  updated_at = now()
from (
  values
    -- wake
    ('kykhkim@wakecorp.com', '경영진'),
    ('jslee@wakecorp.com', '경영진'),
    ('tlkim@wakecorp.com', '사업기획팀'),
    ('jwkim@wakecorp.com', '사업기획팀'),
    ('sjpark@wakecorp.com', '마케팅팀'),
    ('dekim@wakecorp.com', '마케팅팀'),
    ('dekim2@wakecorp.com', '마케팅팀'),
    ('hjkim@wakecorp.com', '마케팅팀'),
    ('hjmoon@wakecorp.com', '디자인팀'),
    ('yuhong@wakecorp.com', '디자인팀'),
    ('yjchung@wakecorp.com', '디자인팀'),
    ('sbhong@wakecorp.com', '디자인팀'),
    ('ebkim@wakecorp.com', '구매물류팀'),
    ('aykim@wakecorp.com', '인사팀'),
    ('hblee@wakecorp.com', '인사팀'),
    ('shhong@wakecorp.com', '인사팀'),
    ('mjkim@wakecorp.com', '회계팀'),
    -- sans
    ('sjbaek@wakecorp.com', '익선'),
    ('dhkim@wakecorp.com', '익선'),
    ('nakyummi@wakecorp.com', '익선'),
    ('jklee@wakecorp.com', '익선'),
    ('dsjeong@wakecorp.com', '익선'),
    ('momo@wakecorp.com', '신세계강남'),
    -- sans_foundry
    ('dwyu@wakecorp.com', '공장장'),
    ('swhan@wakecorp.com', '생산팀'),
    ('gkkim@wakecorp.com', '생산팀'),
    ('gymaeng@wakecorp.com', '품질팀'),
    ('jyjeong@wakecorp.com', '공무팀'),
    ('jsjeong@wakecorp.com', '지원팀'),
    ('ymkim@wakecorp.com', '물류팀')
) as m(email, new_rank)
where p.email = m.email
  and p.status = 'active';
