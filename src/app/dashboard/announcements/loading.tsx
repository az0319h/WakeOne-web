import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function AnnouncementsLoading() {
  return (
    <PageContainer
      pageTitle='공지사항'
      pageDescription='전사 공지를 확인합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
