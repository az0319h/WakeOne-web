import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function Loading() {
  return (
    <PageContainer
      mobileHeader='hidden'
      pageTitle='퀵 요청 상세'
      pageDescription='진행 상황과 배차 정보를 확인합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
