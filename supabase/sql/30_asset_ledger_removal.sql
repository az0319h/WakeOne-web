-- 2026-07-14: 비품 대장 완전 제거
-- File: 30_asset_ledger_removal.sql
-- Plan: 22_asset-ledger-removal-plan.md
-- Date: 2026-07-14
-- Status: Completed
-- Summary: delete asset.* activity logs (append-only trigger bypass), drop asset_items table and related functions

drop trigger if exists trg_activity_logs_no_update on public.activity_logs;

delete from public.activity_logs
where action in ('asset.create', 'asset.update', 'asset.delete');

create trigger trg_activity_logs_no_update
before update or delete on public.activity_logs
for each row execute function public.prevent_activity_log_mutation();

drop table if exists public.asset_items cascade;

drop function if exists public.suggest_asset_number(text);
drop function if exists public.extract_asset_prefix(text);
