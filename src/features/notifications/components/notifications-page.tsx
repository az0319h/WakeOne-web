'use client';

import { Button } from '@/components/ui/button';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavAccess } from '@/contexts/nav-access';
import { parseAsString, useQueryStates } from 'nuqs';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { NotifUserCombobox } from './notif-user-combobox';
import {
  NotificationInfiniteList,
  useMarkAllNotificationsRead
} from './notification-infinite-list';
import { notificationsInfiniteQueryOptions } from '../api/queries';
import type { Notification } from '../api/types';

interface NotificationTabCounts {
  all: number;
  unread: number;
  read: number;
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

interface NotificationsCountSyncProps {
  filters: { notif_user?: string };
  onCountsChange: (counts: NotificationTabCounts) => void;
}

function NotificationsCountSync({ filters, onCountsChange }: NotificationsCountSyncProps) {
  const { data } = useSuspenseInfiniteQuery(notificationsInfiniteQueryOptions(filters));
  const allNotifications = useMemo(() => flattenNotifications(data.pages), [data.pages]);

  useEffect(() => {
    onCountsChange({
      all: allNotifications.length,
      unread: allNotifications.filter((notification) => notification.status === 'unread').length,
      read: allNotifications.filter((notification) => notification.status === 'read').length
    });
  }, [allNotifications, onCountsChange]);

  return null;
}

interface NotificationsTabBodiesProps {
  filters: { notif_user?: string };
  isViewingSelf: boolean;
  onCountsChange: (counts: NotificationTabCounts) => void;
}

function NotificationsTabBodies({
  filters,
  isViewingSelf,
  onCountsChange
}: NotificationsTabBodiesProps) {
  return (
    <>
      <NotificationsCountSync filters={filters} onCountsChange={onCountsChange} />
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
    </>
  );
}
export function NotificationsPage() {
  const profile = useNavAccess();
  const isAdmin = profile?.system_role === 'admin';

  const [params, setParams] = useQueryStates({
    notif_user: parseAsString.withDefault('self')
  });

  const [tabCounts, setTabCounts] = useState<NotificationTabCounts>({
    all: 0,
    unread: 0,
    read: 0
  });

  const notifUser = isAdmin ? (params.notif_user ?? 'self') : undefined;
  const filters = {
    ...(isAdmin && { notif_user: notifUser })
  };

  const isViewingSelf =
    !isAdmin || notifUser === 'self' || notifUser === profile?.user_id;

  const suspenseKey = isAdmin ? (params.notif_user ?? 'self') : 'self';
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
        {isViewingSelf && tabCounts.unread > 0 ? (
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
          <TabsTrigger value='all'>전체 ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value='unread'>읽지 않음 ({tabCounts.unread})</TabsTrigger>
          <TabsTrigger value='read'>읽음 ({tabCounts.read})</TabsTrigger>
        </TabsList>
        <Suspense key={suspenseKey} fallback={<PageLoadingSpinner variant='fill' />}>
          <NotificationsTabBodies
            filters={filters}
            isViewingSelf={isViewingSelf}
            onCountsChange={setTabCounts}
          />
        </Suspense>
      </Tabs>
    </div>
  );
}
