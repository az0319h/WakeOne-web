import type { NotificationAction } from '@/components/ui/notification-card';
import type { Notification } from '../api/types';

export const NOTIFICATION_ACTION_ROUTES: Record<string, string> = {
  'view-profile': '/dashboard/profile',
  'view-pending-users': '/dashboard/users?status=pending_approval',
  'view-system-email-logs': '/dashboard/system-email-logs',
  'view-balance-email-logs': '/dashboard/wallet/balance-email-logs',
  'view-wallet': '/dashboard/wallet',
  'view-announcement': '/dashboard/announcements',
  'view-support': '/dashboard/support',
  'view-contracts': '/dashboard/contracts',
  'view-my-contracts': '/dashboard/my-contracts',
  'view-benefits': '/dashboard/benefits',
  'view-my-benefits': '/dashboard/my-benefits',
  'view-workflow': '/dashboard/workflow',
  'view-quick-request': '/dashboard/quick',
  'view-quick-request-chat': '/dashboard/quick/chat',
  // plan 103 — 실제 경로는 resolveNotificationRoute가 metadata(asset_target_type·asset_request_id)로 완성
  'view-asset-request': '/dashboard/equipment?view=requests'
};

export function getNotificationActions(
  notification: Notification
): NotificationAction[] {
  if (notification.type === 'user.update') {
    return [
      {
        id: 'view-profile',
        label: '프로필 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type === 'user.approval_request_admin') {
    return [
      {
        id: 'view-pending-users',
        label: '승인 대기 목록',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type === 'contract.reminder_admin') {
    return [
      {
        id: 'view-system-email-logs',
        label: '발송 이력 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type === 'wallet.balance_email_admin') {
    return [
      {
        id: 'view-balance-email-logs',
        label: '발송 이력 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type === 'contract.reminder_recipient') {
    return [];
  }

  if (notification.type === 'contract.import_admin') {
    return [
      {
        id: 'view-contracts',
        label: '계약서 관리',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type === 'contract.import_author') {
    return [
      {
        id: 'view-my-contracts',
        label: '내 계약서에서 확인',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (
    notification.type === 'wallet.sync_admin' ||
    notification.type === 'wallet.sync_recipient' ||
    notification.type === 'wallet.balance_email'
  ) {
    return [
      {
        id: 'view-wallet',
        label: '식대 카드 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type === 'announcement.published') {
    return [
      {
        id: 'view-announcement',
        label: '공지 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type.startsWith('support.')) {
    return [
      {
        id: 'view-support',
        label: '문의 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  // plan 93 — 채팅 알림은 「퀵 대화」로 (다른 퀵 알림은 「퀵 요청 보기」 유지)
  // plan 101 D-6 ① — 참여자 초대 알림도 「퀵 대화」(그 건 선택) · metadata.quick_request_event 분기
  if (
    notification.type === 'quick_request.chat_message' ||
    (notification.type === 'quick_request.requester_event' &&
      notification.metadata?.quick_request_event === 'participant_invited')
  ) {
    return [
      {
        id: 'view-quick-request-chat',
        label: '채팅 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type.startsWith('quick_request.')) {
    return [
      {
        id: 'view-quick-request',
        label: '퀵 요청 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  // plan 103 — 구독·비품 요청 6종
  if (notification.type.startsWith('asset_request.')) {
    return [
      {
        id: 'view-asset-request',
        label: '요청 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (notification.type.startsWith('workflow.')) {
    return [
      {
        id: 'view-workflow',
        label: '문서 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (
    notification.type === 'benefit.import_operations' ||
    notification.type === 'benefit.document_cancel_operations' ||
    notification.type === 'benefit.document_restore_operations'
  ) {
    return [
      {
        id: 'view-benefits',
        label: '복지비 관리',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  if (
    notification.type === 'benefit.import_applicant' ||
    notification.type === 'benefit.document_cancel_applicant' ||
    notification.type === 'benefit.document_restore_applicant'
  ) {
    return [
      {
        id: 'view-my-benefits',
        label: '내 복지비 보기',
        type: 'redirect',
        style: 'primary'
      }
    ];
  }

  return [];
}
