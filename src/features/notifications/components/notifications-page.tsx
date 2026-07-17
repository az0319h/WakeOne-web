'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavAccess } from '@/contexts/nav-access';
import { parseAsString, useQueryStates } from 'nuqs';
import { Suspense, useMemo } from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { NotifUserCombobox } from './notif-user-combobox';
import {
  NotificationInfiniteList,
  useMarkAllNotificationsRead
} from './notification-infinite-list';
import { notificationsInfiniteQueryOptions } from '../api/queries';
import type { Notification } from '../api/types';

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

function NotificationsPageContent() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';

  const [params, setParams] = useQueryStates({
    notif_user: parseAsString.withDefault('self')
  });

  const notifUser = isAdmin ? (params.notif_user ?? 'self') : undefined;
  const filters = {
    ...(isAdmin && { notif_user: notifUser })
  };

  const isViewingSelf =
    !isAdmin || notifUser === 'self' || notifUser === profile?.user_id;

  const { data } = useSuspenseInfiniteQuery(notificationsInfiniteQueryOptions(filters));
  const allNotifications = useMemo(() => flattenNotifications(data.pages), [data.pages]);
  const unreadCount = allNotifications.filter((n) => n.status === 'unread').length;
  const readCount = allNotifications.filter((n) => n.status === 'read').length;

  const markAllMutation = useMarkAllNotificationsRead();

  function handleNotifUserChange(nextValue: string) {
    void setParams({ notif_user: nextValue });
  }

  return (
    <div data-testid='notifications-page' className='flex flex-1 flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        {isAdmin ? (
          <NotifUserCombobox value={notifUser ?? 'self'} onValueChange={handleNotifUserChange} />
        ) : (
          <div />
        )}
        {isViewingSelf && unreadCount > 0 ? (
          <Button
            variant='outline'
            size='sm'
            isLoading={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            모두 읽음
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue='all'>
        <TabsList>
          <TabsTrigger value='all'>전체 ({allNotifications.length})</TabsTrigger>
          <TabsTrigger value='unread'>읽지 않음 ({unreadCount})</TabsTrigger>
          <TabsTrigger value='read'>읽음 ({readCount})</TabsTrigger>
        </TabsList>
        <TabsContent value='all' className='mt-4'>
          <NotificationInfiniteList
            filters={filters}
            statusFilter='all'
            readOnly={!isViewingSelf}
          />
        </TabsContent>
        <TabsContent value='unread' className='mt-4'>
          <NotificationInfiniteList
            filters={filters}
            statusFilter='unread'
            readOnly={!isViewingSelf}
            emptyMessage='읽지 않은 알림이 없습니다'
          />
        </TabsContent>
        <TabsContent value='read' className='mt-4'>
          <NotificationInfiniteList
            filters={filters}
            statusFilter='read'
            readOnly={!isViewingSelf}
            emptyMessage='읽은 알림이 없습니다'
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsPageContent />
    </Suspense>
  );
}
