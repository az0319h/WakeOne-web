'use client';

import { Icons } from '@/components/icons';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Suspense, useRef } from 'react';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  NotificationInfiniteList,
  useMarkAllNotificationsRead,
  useNotificationsUnreadCount
} from './notification-infinite-list';

function NotificationCenterContent() {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const count = useNotificationsUnreadCount();
  const markAllMutation = useMarkAllNotificationsRead();

  return (
    <>
      <div className='flex items-center justify-between px-4 py-3'>
        <Link
          href='/dashboard/notifications'
          data-testid='notification-popover-all-link'
          className='group flex items-center gap-1'
        >
          <h4 className='text-sm font-semibold group-hover:underline'>알림</h4>
          <Icons.chevronRight className='text-muted-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5' />
        </Link>
        <div className='flex items-center gap-2'>
          {count > 0 && (
            <span className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs'>
              {count}개 새 알림
            </span>
          )}
          {count > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground h-auto px-2 py-1 text-xs'
              isLoading={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              모두 읽음
            </Button>
          )}
        </div>
      </div>
      <Separator />
      <div ref={scrollRootRef} className='h-[400px] overflow-y-auto'>
        <NotificationInfiniteList
          className='p-2'
          emptyMessage='알림이 없습니다'
          intersectionRootRef={scrollRootRef}
        />
      </div>
    </>
  );
}

export function NotificationCenter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative h-8 w-8'
          data-testid='notification-bell'
        >
          <Icons.notification className='h-4 w-4' />
          <Suspense fallback={null}>
            <NotificationCenterBadge />
          </Suspense>
          <span className='sr-only'>알림</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[calc(100vw-2rem)] p-0 sm:w-[380px]' sideOffset={8}>
        <Suspense fallback={<PageLoadingSpinner variant='compact' />}>
          <NotificationCenterContent />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

function NotificationCenterBadge() {
  const count = useNotificationsUnreadCount();

  if (count <= 0) return null;

  return (
    <span className='bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>
      {count > 9 ? '9+' : count}
    </span>
  );
}
