import PageContainer from '@/components/layout/page-container';
import WalletBalanceEmailLogListing from '@/features/wallet-balance-email-logs/components/wallet-balance-email-log-listing';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { requireAdminPage } from '@/features/auth/api/session.server';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function WalletBalanceEmailLogsPage(props: PageProps) {
  await requireAdminPage();

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='잔액 확인 이메일 로그'
      pageDescription='식대 잔액 확인 이메일 Cron 발송 run 이력을 확인합니다.'
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <WalletBalanceEmailLogListing />
      </Suspense>
    </PageContainer>
  );
}
