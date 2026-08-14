import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function MyContractsLoading() {
  return (
    <PageContainer
      pageTitle='내 계약서'
      pageDescription='본인 이름으로 작성된 계약서 체결 요청 문서를 확인합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
