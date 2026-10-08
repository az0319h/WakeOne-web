import PageContainer from '@/components/layout/page-container';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { OrgChartListing } from '@/features/org-chart/components/org-chart-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function OrgChartPage(props: PageProps) {
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
      viewportFill
      pageTitle='조직도'
      pageDescription='임직원 조직을 확인합니다.'
    >
      <OrgChartListing />
    </PageContainer>
  );
}
