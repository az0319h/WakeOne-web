-- 2026-08-10: notifications.type에 announcement.published 추가
-- File: 42_notifications_announcement_type.sql
-- Plan: 39_announcements-plan.md
-- Date: 2026-08-10
-- Status: Completed
-- Remote migration: applied via MCP (2026-08-10)
-- Summary: 공지 fan-out 알림 타입 announcement.published 허용

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'wallet.sync_admin',
      'wallet.sync_recipient',
      'announcement.published'
    )
  );
