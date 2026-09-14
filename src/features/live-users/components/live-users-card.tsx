'use client';

import { Icons } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useDashboardPresence } from '../hooks/use-dashboard-presence';
import { LiveUsersList } from './live-users-list';

function getDescription(count: number, isSynced: boolean): string {
  if (!isSynced) {
    return '';
  }

  if (count >= 1) {
    return `${count}명이 접속 중입니다`;
  }

  return '현재 접속 중인 사용자가 없습니다';
}

export function LiveUsersCard() {
  const { users, isSynced } = useDashboardPresence();
  const count = users.length;
  const description = getDescription(count, isSynced);

  return (
    <Card
      className='h-fit w-full self-start'
      data-testid='live-users-card'
      data-synced={isSynced ? 'true' : 'false'}
    >
      <CardHeader>
        <CardTitle>접속 중</CardTitle>
        {description ? (
          <CardDescription data-testid='live-users-description'>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {!isSynced ? (
          <div className='flex justify-center py-8'>
            <PageLoadingSpinner variant='compact' />
          </div>
        ) : count === 0 ? (
          <div className='flex flex-col items-center justify-center py-16'>
            <Icons.user className='text-muted-foreground/40 mb-3 h-10 w-10' />
            <p className='text-muted-foreground text-sm'>현재 접속 중인 사용자가 없습니다</p>
          </div>
        ) : (
          <LiveUsersList users={users} />
        )}
      </CardContent>
    </Card>
  );
}
