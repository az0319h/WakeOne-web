import PageContainer from '@/components/layout/page-container';
import { ProfilePageContent } from '@/features/auth/components/profile-page-content';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Profile'
};

export default async function ProfilePage() {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect('/auth/sign-in');
  }

  if (profile.status === 'inactive') {
    redirect('/auth/sign-in?accountDisabled=1');
  }

  return (
    <PageContainer
      pageTitle='프로필'
      pageDescription='계정 정보와 보안 설정을 관리합니다.'
    >
      <ProfilePageContent profile={profile} />
    </PageContainer>
  );
}
