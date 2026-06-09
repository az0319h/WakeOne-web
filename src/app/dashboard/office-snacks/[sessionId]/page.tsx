import PageContainer from '@/components/layout/page-container';
import OfficeSnackDetail from '@/features/office-snacks/components/office-snack-detail';
import { requireOfficeSnacksPage } from '@/features/auth/api/session.server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: 간식 회차 상세'
};

interface OfficeSnackDetailPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function OfficeSnackDetailPage(props: OfficeSnackDetailPageProps) {
  const profile = await requireOfficeSnacksPage();

  const { sessionId: rawSessionId } = await props.params;
  const sessionId = Number(rawSessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    redirect('/dashboard/office-snacks');
  }

  return (
    <PageContainer
      pageTitle='간식 회차 상세'
      pageDescription='등록/투표/결과 상태에 따라 필요한 액션을 수행합니다.'
    >
      <OfficeSnackDetail sessionId={sessionId} userId={profile.user_id} />
    </PageContainer>
  );
}
