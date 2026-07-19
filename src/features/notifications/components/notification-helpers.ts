import type { NotificationAction } from '@/components/ui/notification-card';
import type { Notification } from '../api/types';

export const NOTIFICATION_ACTION_ROUTES: Record<string, string> = {
  'view-profile': '/dashboard/profile',
  'view-system-email-logs': '/dashboard/system-email-logs'
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

  if (notification.type === 'contract.reminder_recipient') {
    return [];
  }

  return [];
}
