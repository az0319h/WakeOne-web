import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { WalletListing } from '@/features/wallet/components/wallet-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: Wallet'
};

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

  const isAdmin = profile.system_role === 'admin';

  return (
    <PageContainer
      pageTitle='지갑'
      pageDescription={
        isAdmin
          ? 'KB국민카드에서 동기화된 월간 한도를 본인 및 선택한 사용자 기준으로 확인합니다.'
          : 'KB국민카드에서 동기화된 월간 한도와 잔여 금액을 확인합니다.'
      }
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <WalletListing />
      </Suspense>
    </PageContainer>
  );
}
