import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function ContractsLoading() {
  return (
    <PageContainer
      pageTitle='계약서 관리'
      pageDescription='계약서 체결 요청 문서와 첨부 상태를 관리합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
