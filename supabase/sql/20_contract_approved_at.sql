-- 2026-07-08: 계약서 문서승인일 컬럼 추가
-- File: 20_contract_approved_at.sql
-- Plan: 18_contract-approved-at-plan.md
-- Date: 2026-07-08
-- Status: Completed
-- Remote migration: applied (version 20260708083215)
-- Summary: Add nullable approved_at timestamp to contract documents without backfill

alter table public.contract_documents
  add column if not exists approved_at timestamptz;

create index if not exists idx_contract_documents_approved_at
  on public.contract_documents (approved_at desc);
