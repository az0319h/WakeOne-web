import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { markAllNotificationsRead, markNotificationRead } from './service';
import { notificationKeys } from './keys';

function invalidateNotifications() {
  getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
}

export const markNotificationReadMutation = mutationOptions({
  mutationFn: (id: number) => markNotificationRead(id),
  onSettled: () => {
    invalidateNotifications();
  }
});

export const markAllNotificationsReadMutation = mutationOptions({
  mutationFn: () => markAllNotificationsRead(),
  onSettled: () => {
    invalidateNotifications();
  }
});
