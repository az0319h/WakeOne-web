import type { NotificationType } from '../api/types';

/**
 * plan 91 — 휴대폰 푸시 알림 그룹 (9개). 저장 단위는 그룹이며, 30종 type은 정확히 한 그룹에 속한다.
 * SQL 90 `push_notification_preferences_groups_check`의 목록과 동일해야 한다. 그룹을 추가하는 plan은 둘을 함께 바꾼다.
 */
export const PUSH_GROUP_KEYS = [
  'profile',
  'users',
  'contract',
  'wallet',
  'announcement',
  'support',
  'benefit',
  'workflow',
  'quick_request'
] as const;

export type PushGroupKey = (typeof PUSH_GROUP_KEYS)[number];

export type PushGroupCatalogItem = {
  key: PushGroupKey;
  label: string;
  description: string;
  admin_only: boolean;
  /** plan 95 D-5 — 동방특송 계정에게 보이는(그리고 생성되는) 그룹. `quick_request`·`profile`만 true */
  dongbang_visible: boolean;
};

/** 그룹 카탈로그 (designer 문자열). admin_only 그룹은 admin에게만 노출 · dongbang_visible 그룹만 동방특송에게 노출 */
export const PUSH_GROUP_CATALOG: readonly PushGroupCatalogItem[] = [
  {
    key: 'profile',
    label: '프로필 변경',
    description: '내 프로필 정보가 바뀌었을 때',
    admin_only: false,
    dongbang_visible: true
  },
  {
    key: 'users',
    label: '사용자 승인 요청',
    description: '새 사용자가 승인을 기다릴 때 (관리자)',
    admin_only: true,
    dongbang_visible: false
  },
  {
    key: 'contract',
    label: '계약서',
    description: '계약서 만료 안내·등록 알림',
    admin_only: false,
    dongbang_visible: false
  },
  {
    key: 'wallet',
    label: '식대 카드',
    description: '잔액 동기화·잔액 안내 메일 결과',
    admin_only: false,
    dongbang_visible: false
  },
  {
    key: 'announcement',
    label: '공지사항',
    description: '새 공지가 발행되었을 때',
    admin_only: false,
    dongbang_visible: false
  },
  {
    key: 'support',
    label: 'CS 문의',
    description: '문의 등록·답변·상태 변경',
    admin_only: false,
    dongbang_visible: false
  },
  {
    key: 'benefit',
    label: '복지비',
    description: '복지비 신청·서류 취소·복구',
    admin_only: false,
    dongbang_visible: false
  },
  {
    key: 'workflow',
    label: '전자결재',
    description: '결재 요청·참조·완료·반려·취소·댓글',
    admin_only: false,
    dongbang_visible: false
  },
  {
    key: 'quick_request',
    label: '퀵 요청',
    description: '퀵 요청 접수·배차·진행 변경·대화 메시지',
    admin_only: false,
    dongbang_visible: true
  }
];

/** 31종(plan 93 +1) → 9그룹 exhaustive 매핑. type을 추가하는 plan은 여기에도 그룹을 지정해야 한다(누락 시 tsc 실패) */
export const PUSH_NOTIFICATION_GROUPS: Record<NotificationType, PushGroupKey> = {
  'user.update': 'profile',
  'user.approval_request_admin': 'users',
  'contract.reminder_admin': 'contract',
  'contract.reminder_recipient': 'contract',
  'contract.import_admin': 'contract',
  'contract.import_author': 'contract',
  'wallet.sync_admin': 'wallet',
  'wallet.sync_recipient': 'wallet',
  'wallet.balance_email': 'wallet',
  'wallet.balance_email_admin': 'wallet',
  'announcement.published': 'announcement',
  'support.created': 'support',
  'support.updated': 'support',
  'support.status_changed': 'support',
  'support.comment_created': 'support',
  'support.reply_created': 'support',
  'benefit.import_operations': 'benefit',
  'benefit.import_applicant': 'benefit',
  'benefit.document_cancel_operations': 'benefit',
  'benefit.document_cancel_applicant': 'benefit',
  'benefit.document_restore_operations': 'benefit',
  'benefit.document_restore_applicant': 'benefit',
  'workflow.approval_requested': 'workflow',
  'workflow.referrer_requested': 'workflow',
  'workflow.completed': 'workflow',
  'workflow.declined': 'workflow',
  'workflow.canceled': 'workflow',
  'workflow.comment_created': 'workflow',
  'quick_request.vendor_event': 'quick_request',
  'quick_request.requester_event': 'quick_request',
  // plan 93 append — 채팅 원문이 그대로 OS 알림이 된다. 끄려면 「퀵 요청」 그룹 OFF
  'quick_request.chat_message': 'quick_request'
};

export function isPushGroupKey(value: unknown): value is PushGroupKey {
  return typeof value === 'string' && (PUSH_GROUP_KEYS as readonly string[]).includes(value);
}

/** 알 수 없는 type(미래 추가분이 DB에 먼저 들어온 경우)은 null — 발송은 계속한다 */
export function groupOfType(type: string): PushGroupKey | null {
  return (PUSH_NOTIFICATION_GROUPS as Record<string, PushGroupKey | undefined>)[type] ?? null;
}

export type PushGroupAudienceOptions = {
  /** plan 95 — 동방특송 계정이면 `dongbang_visible` 그룹(2개)만 */
  dongbang?: boolean;
};

/** 역할별 그룹 카탈로그 — user 8 · admin 9 · 동방특송 2 (`profile`·`quick_request`) */
export function listPushGroupsForRole(
  role: 'admin' | 'user',
  options: PushGroupAudienceOptions = {}
): PushGroupCatalogItem[] {
  return PUSH_GROUP_CATALOG.filter((group) => {
    if (options.dongbang) {
      return group.dongbang_visible && (role === 'admin' || !group.admin_only);
    }
    return role === 'admin' || !group.admin_only;
  });
}

/** plan 95 D-4·D-5 — 동방특송 계정에게 허용되는 그룹인지. 알 수 없는 그룹(null)은 허용하지 않는다 */
export function isPushGroupVisibleForDongbang(group: PushGroupKey | null): boolean {
  if (group === null) return false;
  return PUSH_GROUP_CATALOG.some((item) => item.key === group && item.dongbang_visible);
}

/** plan 95 D-4 — 동방특송 수신자에게 생성해도 되는 알림 type인지 (`groupOfType` → `dongbang_visible`) */
export function isNotificationTypeAllowedForDongbang(type: string): boolean {
  return isPushGroupVisibleForDongbang(groupOfType(type));
}
