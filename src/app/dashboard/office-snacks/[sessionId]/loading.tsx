import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function OfficeSnackDetailLoading() {
  return (
    <PageContainer
      pageTitle='간식 회차 상세'
      pageDescription='등록/투표/결과 상태에 따라 필요한 액션을 수행합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
