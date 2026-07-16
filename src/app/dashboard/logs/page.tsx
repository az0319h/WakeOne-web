import PageContainer from '@/components/layout/page-container';
import ActivityLogListing from '@/features/activity-logs/components/activity-log-listing';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

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

  if (isAdmin && searchParamsCache.get('log_user') == null) {
    redirect('/dashboard/logs?log_user=self');
  }

  return (
    <PageContainer
      pageTitle='활동 로그'
      pageDescription={
        isAdmin
          ? '본인 및 선택한 사용자의 활동 이력을 확인합니다.'
          : '본인과 관련된 활동 이력을 확인합니다.'
      }
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <ActivityLogListing />
      </Suspense>
    </PageContainer>
  );
}
