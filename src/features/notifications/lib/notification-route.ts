import type { Notification, NotificationMetadata, NotificationType } from '../api/types';
import { getNotificationActions, NOTIFICATION_ACTION_ROUTES } from '../components/notification-helpers';

export const NOTIFICATIONS_PAGE_ROUTE = '/dashboard/notifications';

type RoutableNotification = {
  type: NotificationType;
  metadata?: NotificationMetadata | null;
};

/**
 * plan 91 D-7 — 알림 클릭 이동 URL 공용 계산.
 * `NOTIFICATION_ACTION_ROUTES` + `notification-infinite-list.tsx`의 metadata 분기와 **동일한 결과**를 돌려준다.
 * FE 클릭과 푸시 payload `url` 양쪽이 이 함수를 쓴다. 규칙 없는 타입은 `/dashboard/notifications`.
 */
export function resolveNotificationRoute(notification: RoutableNotification): string {
  const actions = getNotificationActions({ type: notification.type } as Notification);
  const actionId = actions[0]?.id;
  const metadata = notification.metadata ?? {};
  let route: string | undefined = actionId ? NOTIFICATION_ACTION_ROUTES[actionId] : undefined;

  if (actionId === 'view-announcement' && typeof metadata.announcement_id === 'number') {
    route = `/dashboard/announcements?announcement=${metadata.announcement_id}`;
  }

  if (actionId === 'view-support' && typeof metadata.support_request_id === 'number') {
    route = `/dashboard/support?support=${metadata.support_request_id}`;
  }

  if (actionId === 'view-workflow' && typeof metadata.workflow_document_id === 'string') {
    route = `/dashboard/workflow?doc=${encodeURIComponent(metadata.workflow_document_id)}`;
  }

  if (actionId === 'view-quick-request' && typeof metadata.quick_request_no === 'string') {
    route = `/dashboard/quick/${encodeURIComponent(metadata.quick_request_no)}`;
  }

  // plan 93 append — 「채팅 보기」: 「퀵 대화」에서 그 건이 선택된 상태 (C-7)
  if (actionId === 'view-quick-request-chat' && typeof metadata.quick_request_no === 'string') {
    route = `/dashboard/quick/chat?request=${encodeURIComponent(metadata.quick_request_no)}`;
  }

  return route ?? NOTIFICATIONS_PAGE_ROUTE;
}
