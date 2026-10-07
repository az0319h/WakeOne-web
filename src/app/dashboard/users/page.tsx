import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import UserListingPage from '@/features/users/components/user-listing';
import { UserProvisionTrigger } from '@/features/users/components/user-provision-trigger';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { usersInfoContent } from '@/features/users/info-content';
import { requireAdminPage } from '@/features/auth/api/session.server';
import { isDevUserProvisioningUiEnabled } from '@/lib/env/wakeone-env';
import { Suspense } from 'react';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function UsersPage(props: PageProps) {
  await requireAdminPage();

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='사용자 관리'
      pageDescription='Google 가입 승인 및 사용자 목록을 관리합니다.'
      infoContent={usersInfoContent}
      pageHeaderAction={
        isDevUserProvisioningUiEnabled() ? <UserProvisionTrigger /> : undefined
      }
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <UserListingPage />
      </Suspense>
    </PageContainer>
  );
}
