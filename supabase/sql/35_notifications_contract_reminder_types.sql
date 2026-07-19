-- 2026-07-18: notifications.type CHECK에 contract reminder 알림 타입 추가
-- File: 35_notifications_contract_reminder_types.sql
-- Plan: 28_contract-reminder-notifications-plan.md
-- Date: 2026-07-18
-- Status: Completed
-- Remote migration: applied (notifications_contract_reminder_types)
-- Summary: contract.reminder_admin · contract.reminder_recipient type CHECK 확장

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'user.update',
    'contract.reminder_admin',
    'contract.reminder_recipient'
  ));
