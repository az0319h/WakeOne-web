import { mutationOptions } from '@tanstack/react-query';
import { notifyError } from '@/lib/notify';
import { getQueryClient } from '@/lib/query-client';
import { notificationKeys } from './keys';
import {
  applyMarkAllNotificationsReadOptimistic,
  applyMarkNotificationReadOptimistic,
  restoreNotificationQueries,
  snapshotNotificationQueries,
  type NotificationQueriesSnapshot
} from './optimistic';
import { markAllNotificationsRead, markNotificationRead } from './service';

type NotificationMutationContext = {
  snapshot: NotificationQueriesSnapshot;
};

function invalidateNotifications() {
  getQueryClient().invalidateQueries({ queryKey: notificationKeys.all });
}

export const markNotificationReadMutation = mutationOptions({
  mutationFn: (id: number) => markNotificationRead(id),
  onMutate: async (id) => {
    const queryClient = getQueryClient();
    await queryClient.cancelQueries({ queryKey: notificationKeys.all });
    const snapshot = snapshotNotificationQueries(queryClient);
    applyMarkNotificationReadOptimistic(queryClient, id);
    return { snapshot } satisfies NotificationMutationContext;
  },
  onError: (_error, _id, context) => {
    if (context?.snapshot) {
      restoreNotificationQueries(getQueryClient(), context.snapshot);
    }
    notifyError('알림 읽음 처리에 실패했습니다.');
  },
  onSettled: () => {
    invalidateNotifications();
  }
});

export const markAllNotificationsReadMutation = mutationOptions({
  mutationFn: () => markAllNotificationsRead(),
  onMutate: async () => {
    const queryClient = getQueryClient();
    await queryClient.cancelQueries({ queryKey: notificationKeys.all });
    const snapshot = snapshotNotificationQueries(queryClient);
    applyMarkAllNotificationsReadOptimistic(queryClient);
    return { snapshot } satisfies NotificationMutationContext;
  },
  onError: (_error, _variables, context) => {
    if (context?.snapshot) {
      restoreNotificationQueries(getQueryClient(), context.snapshot);
    }
    notifyError('모두 읽음 처리에 실패했습니다.');
  },
  onSettled: () => {
    invalidateNotifications();
  }
});
