import PageContainer from '@/components/layout/page-container';
import AnnouncementsListing from '@/features/announcements/components/announcements-listing';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function AnnouncementsPageRoute(props: PageProps) {
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
      pageTitle='공지사항'
      pageDescription='전사 공지를 확인합니다.'
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <AnnouncementsListing />
      </Suspense>
    </PageContainer>
  );
}
