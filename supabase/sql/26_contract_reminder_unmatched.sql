-- 2026-07-10: 계약서 독촉 run에 미매칭 작성자 이력 컬럼 추가
-- File: 26_contract_reminder_unmatched.sql
-- Plan: 20_contract-reminder-email-plan.md
-- Date: 2026-07-10
-- Status: Completed
-- Remote migration: applied (26_contract_reminder_unmatched)
-- Summary: contract_reminder_runs.unmatched_targets jsonb for no_profile_match authors

alter table public.contract_reminder_runs
  add column if not exists unmatched_targets jsonb not null default '[]'::jsonb;
