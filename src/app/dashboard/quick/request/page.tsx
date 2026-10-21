import { HydrationBoundary, dehydrate, type QueryClient } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { getSessionProfile } from '@/features/auth/api/session.server';
import {
  quickRequestNotesQueryOptions,
  quickRequestRecentAddressesQueryOptions
} from '@/features/quick-request/api/queries';
import {
  listQuickRequestNotes,
  listQuickRequestRecentAddresses
} from '@/features/quick-request/api/service.server';
import { QuickRequestPageContent } from '@/features/quick-request/components/quick-request-page-content';
import { getQueryClient } from '@/lib/query-client';
import { redirect } from 'next/navigation';

/**
 * 서버 prefetch 실패(테이블 미적용·DB 오류)는 삼킨다.
 * 실패한 query는 dehydrate 대상이 아니므로 클라이언트가 다시 조회하고,
 * 그 결과는 섹션별 오류 경계가 처리한다 — 페이지 전체가 죽지 않는다.
 */
async function prefetchQuickRequestData(queryClient: QueryClient, userId: string) {
  await Promise.all([
    queryClient.prefetchQuery({
      ...quickRequestNotesQueryOptions(),
      queryFn: () => listQuickRequestNotes(userId)
    }),
    queryClient.prefetchQuery({
      ...quickRequestRecentAddressesQueryOptions(),
      queryFn: () => listQuickRequestRecentAddresses(userId)
    })
  ]).catch(() => undefined);
}

export default async function QuickRequestPage() {
  if (process.env.E2E_SLOW_QUICK_REQUEST === '1') {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  const profile = await getSessionProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  if (profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  const queryClient = getQueryClient();
  await prefetchQuickRequestData(queryClient, profile.user_id);

  return (
    <PageContainer
      viewportFill
      pageTitle='🚚 퀵 배송 요청'
      pageDescription='동방특송 퀵 배송 요청을 한 화면에서 작성합니다.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QuickRequestPageContent
          requesterName={profile.full_name}
          profileDefaults={{
            full_name: profile.full_name,
            phone: profile.phone
          }}
        />
      </HydrationBoundary>
    </PageContainer>
  );
}
