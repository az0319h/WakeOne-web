-- 2026-06-10: category 컬럼 추가 및 legacy usage_location NULL 처리
-- File: 16_asset_ledger_category_department.sql
-- Plan: 15_asset-ledger-plan.md
-- Date: 2026-06-10
-- Status: Completed
-- Remote migration: applied (16_asset_ledger_category_department)
-- Summary: add nullable category column, nullify legacy usage_location values, index category

update public.asset_items
set usage_location = null
where usage_location is not null;

alter table public.asset_items
  add column if not exists category text;

alter table public.asset_items
  drop constraint if exists asset_items_category_length_check;

alter table public.asset_items
  add constraint asset_items_category_length_check
  check (category is null or char_length(category) <= 200);

create index if not exists idx_asset_items_category
  on public.asset_items (category);
