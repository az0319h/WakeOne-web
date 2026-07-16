import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function OfficeSnacksLoading() {
  return (
    <PageContainer
      pageTitle='사무실 간식'
      pageDescription='회차를 확인하고 간식 등록, 투표, 결과를 관리합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
