import PageContainer from '@/components/layout/page-container';
import { ProfilePageContent } from '@/features/auth/components/profile-page-content';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { getPushPreferencesForUser } from '@/features/notifications/api/push-preferences.server';
import { pushPreferencesQueryOptions } from '@/features/notifications/api/push-queries';
import { getQueryClient } from '@/lib/query-client';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  if (profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  // plan 91 — 「휴대폰 알림」 섹션 Read prefetch (클라이언트 useSuspenseQuery가 SSR에서 fetch하지 않도록)
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery({
    ...pushPreferencesQueryOptions(),
    queryFn: () => getPushPreferencesForUser(profile.user_id, profile.system_role)
  });

  return (
    <PageContainer
      pageTitle='프로필'
      pageDescription='계정 정보와 보안 설정을 관리합니다.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProfilePageContent profile={profile} />
      </HydrationBoundary>
    </PageContainer>
  );
}
