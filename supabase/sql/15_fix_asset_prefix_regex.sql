-- 2026-06-09: extract_asset_prefix 정규식 이스케이프 오류 수정
-- File: 15_fix_asset_prefix_regex.sql
-- Plan: 15_asset-ledger-plan.md
-- Date: 2026-06-09
-- Status: Completed
-- Remote migration: applied (15_fix_asset_prefix_regex)
-- Summary: fix extract_asset_prefix regex to match `(X)` style prefixes and restore suggest-number behavior

create or replace function public.extract_asset_prefix(asset_name text)
returns text
language sql
stable
as $$
  select nullif(upper(btrim((regexp_match(asset_name, '\(([^)]+)\)'))[1])), '');
$$;
