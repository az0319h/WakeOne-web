import PageContainer from '@/components/layout/page-container';
import SystemEmailLogListing from '@/features/system-email-logs/components/system-email-log-listing';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { requireAdminPage } from '@/features/auth/api/session.server';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { Suspense } from 'react';

export const metadata = {
  title: 'Dashboard: 독촉 이메일 로그'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function SystemEmailLogsPage(props: PageProps) {
  await requireAdminPage();

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='독촉 이메일 로그'
      pageDescription='계약서 첨부 누락 독촉 등 시스템 발송 이메일 run 이력을 확인합니다.'
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <SystemEmailLogListing />
      </Suspense>
    </PageContainer>
  );
}
