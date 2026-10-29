import PageContainer from '@/components/layout/page-container';
import NotificationsListing from '@/features/notifications/components/notifications-listing';
import { isDongbang } from '@/features/auth/api/quick-access.server';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { getPushPreferencesForUser } from '@/features/notifications/api/push-preferences.server';
import { pushPreferencesQueryOptions } from '@/features/notifications/api/push-queries';
import { getQueryClient } from '@/lib/query-client';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { searchParamsCache } from '@/lib/searchparams';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

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

  // plan 91 — PushStatusBanner·PushPreferencesDialog Read prefetch
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery({
    ...pushPreferencesQueryOptions(),
    queryFn: () =>
      getPushPreferencesForUser(profile.user_id, profile.system_role, { dongbang: isDongbang(profile) })
  });

  return (
    <PageContainer
      pageTitle='알림'
      pageDescription='알림을 확인하고 관리합니다.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
          <NotificationsListing />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
