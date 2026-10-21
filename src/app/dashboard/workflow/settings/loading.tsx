import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function WorkflowSettingsLoading() {
  return (
    <PageContainer
      pageTitle='워크플로우 설정'
      pageDescription='워크플로우 관리자와 양식별 기본 결재선을 관리합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
