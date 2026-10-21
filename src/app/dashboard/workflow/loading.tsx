import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function WorkflowLoading() {
  return (
    <PageContainer
      pageTitle='문서함'
      pageDescription='내가 작성하거나 승인·참조하는 문서를 확인합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
