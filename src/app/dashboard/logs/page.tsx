import PageContainer from '@/components/layout/page-container';
import ActivityLogListing from '@/features/activity-logs/components/activity-log-listing';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ActivityLogsTableSkeleton } from '@/features/activity-logs/components/activity-logs-table';

export const metadata = {
  title: 'Dashboard: 활동 로그'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function ActivityLogsPage(props: PageProps) {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  if (profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  const isAdmin = profile.system_role === 'admin';

  return (
    <PageContainer
      pageTitle='활동 로그'
      pageDescription={
        isAdmin ? '전체 사용자 활동' : '본인과 관련된 계정 변경 이력을 확인합니다.'
      }
    >
      <Suspense fallback={<ActivityLogsTableSkeleton />}>
        <ActivityLogListing />
      </Suspense>
    </PageContainer>
  );
}
