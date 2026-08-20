import PageContainer from '@/components/layout/page-container';
import SupportListing from '@/features/support/components/support-listing';
import { SupportFormSheetTrigger } from '@/features/support/components/support-form-sheet-trigger';
import { SupportSheetProvider } from '@/features/support/components/support-sheet-context';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function SupportPageRoute(props: PageProps) {
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

  const pageDescription = isAdmin
    ? '전체 사용자 문의를 조회하고 상태를 관리할 수 있습니다.'
    : '등록한 문의의 진행 상태를 확인하고 새 문의를 작성할 수 있습니다.';

  const listing = (
    <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
      <SupportListing />
    </Suspense>
  );

  return (
    <SupportSheetProvider>
      <PageContainer
        pageTitle='CS 문의'
        pageDescription={pageDescription}
        pageHeaderAction={isAdmin ? undefined : <SupportFormSheetTrigger />}
      >
        {listing}
      </PageContainer>
    </SupportSheetProvider>
  );
}
