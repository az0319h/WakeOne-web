-- 2026-08-07: 계약 첨부 per-file 10MB + Storage bucket limit 상향 (문서 총량 50MB는 app layer)
-- File: 40_contract_attachment_10mb_50mb_policy.sql
-- Plan: 38_contract-attachment-size-limit-plan.md
-- Date: 2026-08-07
-- Status: Completed (remote applied)
-- Remote migration: contract_attachment_10mb_50mb_policy
-- Summary: contract_attachments.file_size check 10MB + storage bucket file_size_limit 10485760

alter table public.contract_attachments
  drop constraint if exists contract_attachments_file_size_check;

alter table public.contract_attachments
  add constraint contract_attachments_file_size_check
  check (file_size > 0 and file_size <= 10485760);

update storage.buckets
set file_size_limit = 10485760
where id = 'contract-attachments';
