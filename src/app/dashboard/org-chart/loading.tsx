import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function OrgChartLoading() {
  return (
    <PageContainer
      viewportFill
      pageTitle='조직도'
      pageDescription='임직원 조직을 확인합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
