import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function NotificationsLoading() {
  return (
    <PageContainer
      pageTitle='알림'
      pageDescription='알림을 확인하고 관리합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
