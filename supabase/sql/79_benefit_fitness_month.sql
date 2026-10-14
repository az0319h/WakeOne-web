-- 2026-10-14: 체력증진비 「해당 월」 benefit_month + 귀속 월 attributed_month (generated stored)
-- File: 79_benefit_fitness_month.sql
-- Plan: 80_benefit-fitness-target-month-plan.md
-- Date: 2026-10-14
-- Status: Completed
-- Remote migration: 79_benefit_fitness_month (dev only · main은 별도 승인 후)
-- Summary: benefit_month(date null · 매월 1일 · fitness만) + attributed_month(조회·집계 기준) + 인덱스 2개.
--          웹 배포보다 먼저 적용 — 미적용 상태의 웹은 attributed_month select에서 500.
--          기존 행 backfill·수정 없음 (attributed_month는 stored generated로 자동 계산).

alter table public.benefit_documents
  add column if not exists benefit_month date;

alter table public.benefit_documents
  add constraint benefit_documents_benefit_month_first_day_check
    check (benefit_month is null or extract(day from benefit_month) = 1),
  add constraint benefit_documents_benefit_month_fitness_check
    check (benefit_month is null or benefit_type = 'fitness');

alter table public.benefit_documents
  add column if not exists attributed_month date generated always as (
    case
      when benefit_type = 'fitness' and benefit_month is not null then benefit_month
      else (date_trunc('month', document_created_at::timestamp))::date
    end
  ) stored;

comment on column public.benefit_documents.benefit_month is
  '체력증진비 Flex 「해당 월」(그달 1일). fitness 신규 import만 채움. plan 80';
comment on column public.benefit_documents.attributed_month is
  '조회·월 한도 집계 귀속 월 (fitness=benefit_month, 그 외=작성일 월 1일). 앱 insert/update 금지. plan 80';

create index if not exists idx_benefit_documents_attributed_month_type
  on public.benefit_documents (attributed_month desc, benefit_type);

create index if not exists idx_benefit_documents_user_attributed_month
  on public.benefit_documents (applicant_user_id, attributed_month desc);
