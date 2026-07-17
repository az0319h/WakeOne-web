import PageContainer from '@/components/layout/page-container';
import NotificationsListing from '@/features/notifications/components/notifications-listing';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { searchParamsCache } from '@/lib/searchparams';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: 알림'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function NotificationsPageRoute(props: PageProps) {
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

  if (isAdmin && searchParamsCache.get('notif_user') == null) {
    redirect('/dashboard/notifications?notif_user=self');
  }

  return (
    <PageContainer
      pageTitle='알림'
      pageDescription='알림을 확인하고 관리합니다.'
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <NotificationsListing />
      </Suspense>
    </PageContainer>
  );
}
