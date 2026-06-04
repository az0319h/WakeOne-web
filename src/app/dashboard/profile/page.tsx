import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileForm } from '@/features/auth/components/profile-form';
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

  return (
    <PageContainer
      pageTitle='프로필'
      pageDescription='이름·연락처 등 본인 정보를 수정합니다.'
    >
      <Card>
        <CardHeader>
          <CardTitle>내 프로필</CardTitle>
          <CardDescription>
            초대 시 등록된 이메일은 변경할 수 없습니다. 이름과 연락처는 자유롭게 수정할 수
            있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
