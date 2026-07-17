'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { NotificationCard } from '@/components/ui/notification-card';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { formatRelativeTimeKo } from '@/lib/format-relative-time';
import { useRouter } from 'next/navigation';
import {
  markAllNotificationsReadMutation,
  markNotificationReadMutation
} from '../api/mutations';
import {
  NOTIFICATIONS_PAGE_SIZE,
  notificationsInfiniteQueryOptions,
  type NotificationsListFilters
} from '../api/queries';
import type { Notification, NotificationStatus } from '../api/types';
import {
  getNotificationActions,
  NOTIFICATION_ACTION_ROUTES
} from './notification-helpers';

interface NotificationInfiniteListProps {
  filters?: NotificationsListFilters;
  statusFilter?: NotificationStatus | 'all';
  readOnly?: boolean;
  emptyMessage?: string;
  className?: string;
  intersectionRootRef?: RefObject<Element | null>;
}

function flattenNotifications(
  pages: { notifications: Notification[] }[] | undefined
): Notification[] {
  if (!pages) return [];
  const seen = new Set<number>();
  const result: Notification[] = [];

  for (const page of pages) {
    for (const notification of page.notifications) {
      if (!seen.has(notification.id)) {
        seen.add(notification.id);
        result.push(notification);
      }
    }
  }

  return result;
}

export function NotificationInfiniteList({
  filters = {},
  statusFilter = 'all',
  readOnly = false,
  emptyMessage = '알림이 없습니다',
  className,
  intersectionRootRef
}: NotificationInfiniteListProps) {
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    notificationsInfiniteQueryOptions(filters)
  );

  const markReadMutation = useMutation(markNotificationReadMutation);

  const notifications = useMemo(() => {
    const all = flattenNotifications(data.pages);
    if (statusFilter === 'all') return all;
    return all.filter((notification) => notification.status === statusFilter);
  }, [data.pages, statusFilter]);

  useEffect(() => {
    if (
      statusFilter !== 'all' &&
      notifications.length < NOTIFICATIONS_PAGE_SIZE &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [statusFilter, notifications.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      {
        root: intersectionRootRef?.current ?? null,
        rootMargin: '120px'
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, intersectionRootRef, isFetchingNextPage]);

  function handleMarkAsRead(id: string) {
    markReadMutation.mutate(Number(id));
  }

  function handleAction(notifId: string, actionId: string) {
    const route = NOTIFICATION_ACTION_ROUTES[actionId];
    if (!route) return;

    if (!readOnly) {
      markReadMutation.mutate(Number(notifId));
    }
    router.push(route);
  }

  if (notifications.length === 0) {
    return (
      <div className={className}>
        <div className='flex flex-col items-center justify-center py-16'>
          <Icons.notification className='text-muted-foreground/40 mb-3 h-10 w-10' />
          <p className='text-muted-foreground text-sm'>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className='flex flex-col gap-2'>
        {notifications.map((notification) => (
          <div key={notification.id} data-testid={`notification-card-${notification.id}`}>
            <NotificationCard
              id={String(notification.id)}
            title={notification.title}
            body={notification.body}
            status={notification.status}
            createdAt={notification.created_at}
            relativeTimeLabel={formatRelativeTimeKo(notification.created_at)}
            actions={readOnly ? [] : getNotificationActions(notification)}
            onMarkAsRead={readOnly ? undefined : handleMarkAsRead}
            onAction={readOnly ? undefined : handleAction}
          />
          </div>
        ))}
      </div>
      <div ref={loadMoreRef} className='flex justify-center py-4'>
        {isFetchingNextPage ? <PageLoadingSpinner variant='compact' /> : null}
      </div>
    </div>
  );
}

export function useNotificationsUnreadCount(filters: NotificationsListFilters = {}) {
  const { data } = useSuspenseInfiniteQuery(notificationsInfiniteQueryOptions(filters));
  return useMemo(
    () =>
      flattenNotifications(data.pages).filter((notification) => notification.status === 'unread')
        .length,
    [data.pages]
  );
}

export function useMarkAllNotificationsRead() {
  return useMutation(markAllNotificationsReadMutation);
}
