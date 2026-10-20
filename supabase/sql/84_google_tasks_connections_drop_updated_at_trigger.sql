-- 2026-10-19: plan 81 follow-up — login upsert fails when legacy updated_at trigger remains
-- File: 84_google_tasks_connections_drop_updated_at_trigger.sql
-- Summary: Migration 83 removed updated_at (uses token_updated_at). BEFORE UPDATE trigger
--          trg_google_tasks_connections_updated_at still called set_updated_at() → upsert UPDATE fails.

drop trigger if exists trg_google_tasks_connections_updated_at on public.google_tasks_connections;
