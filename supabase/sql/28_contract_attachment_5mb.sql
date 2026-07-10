-- 계약 첨부파일 행당 총량 한도 1MB → 5MB
-- File: 28_contract_attachment_5mb.sql
-- Status: Completed (remote applied)
-- Summary: contract_attachments.file_size check + storage bucket file_size_limit

alter table public.contract_attachments
  drop constraint if exists contract_attachments_file_size_check;

alter table public.contract_attachments
  add constraint contract_attachments_file_size_check
  check (file_size > 0 and file_size <= 5242880);

update storage.buckets
set file_size_limit = 5242880
where id = 'contract-attachments';
