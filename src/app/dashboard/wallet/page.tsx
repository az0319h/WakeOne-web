import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { WalletListing } from '@/features/wallet/components/wallet-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function WalletPage(props: PageProps) {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  if (profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='식대 카드'
      pageDescription='회사에서 제공하는 식대 체크카드의 이번 달 사용 가능 금액을 확인합니다.'
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <WalletListing />
      </Suspense>
    </PageContainer>
  );
}
