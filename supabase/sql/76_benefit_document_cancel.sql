-- File: 76_benefit_document_cancel.sql
-- Plan: 77_benefit-document-manual-cancel
-- Date: 2026-10-13
-- Summary: soft cancel columns for manual benefit document void / restore

alter table public.benefit_documents
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

create index if not exists idx_benefit_documents_user_month_active
  on public.benefit_documents (applicant_user_id, document_created_at desc)
  where cancelled_at is null;
