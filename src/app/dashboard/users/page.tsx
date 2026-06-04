import PageContainer from '@/components/layout/page-container';
import UserListingPage from '@/features/users/components/user-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';
import { usersInfoContent } from '@/features/users/info-content';
import { UserFormSheetTrigger } from '@/features/users/components/user-form-sheet';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/features/auth/api/session.server';

export const metadata = {
  title: 'Dashboard: Users'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function UsersPage(props: PageProps) {
  const profile = await getSessionProfile();

  if (profile?.system_role !== 'admin') {
    redirect('/dashboard/overview?accessDenied=users');
  }

  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='사용자'
      pageDescription='이메일 초대 및 사용자 목록을 관리합니다.'
      infoContent={usersInfoContent}
      pageHeaderAction={<UserFormSheetTrigger />}
    >
      <UserListingPage />
    </PageContainer>
  );
}
