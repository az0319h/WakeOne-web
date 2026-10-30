import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function Loading() {
  return (
    <PageContainer
      viewportFill='lg'
      mobileHeader='hidden'
      pageTitle='🚚 퀵 배송 요청'
      pageDescription='동방특송 퀵 배송 요청을 한 화면에서 작성합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
