-- 2026-10-13: 복지비 등록·취소·복구 인앱 알림 타입
-- File: 77_notifications_benefit_types.sql
-- Plan: 78_benefit-notifications-plan.md
-- Date: 2026-10-13
-- Status: Completed
-- Remote migration: applied via MCP (2026-10-13)
-- Summary: notifications.type CHECK에 benefit.* 6종 additive 추가

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'user.update',
      'user.approval_request_admin',
      'contract.reminder_admin',
      'contract.reminder_recipient',
      'contract.import_admin',
      'contract.import_author',
      'wallet.sync_admin',
      'wallet.sync_recipient',
      'wallet.balance_email',
      'wallet.balance_email_admin',
      'announcement.published',
      'support.created',
      'support.updated',
      'support.status_changed',
      'support.comment_created',
      'support.reply_created',
      'benefit.import_operations',
      'benefit.import_applicant',
      'benefit.document_cancel_operations',
      'benefit.document_cancel_applicant',
      'benefit.document_restore_operations',
      'benefit.document_restore_applicant'
    )
  );
