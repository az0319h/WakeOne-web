-- 2026-09-11: Dashboard Live 접속자 Presence — Realtime Authorization (plan 49)
-- File: 49_dashboard_presence_realtime.sql
-- Plan: 49_live-users-presence-plan.md
-- Date: 2026-09-11
-- Status: Completed
-- Remote migration: applied via MCP (dashboard_presence_realtime)
-- Summary: private channel `dashboard-presence` — authenticated active users only · presence join/track · no postgres_changes · no new tables

-- Presence listen (sync / join / leave)
drop policy if exists realtime_dashboard_presence_listen on realtime.messages;
create policy realtime_dashboard_presence_listen
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'dashboard-presence'
  and realtime.messages.extension in ('presence')
  and exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
  )
);

-- Presence track (publish own presence state)
drop policy if exists realtime_dashboard_presence_track on realtime.messages;
create policy realtime_dashboard_presence_track
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) = 'dashboard-presence'
  and realtime.messages.extension in ('presence')
  and exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.status = 'active'
  )
);
