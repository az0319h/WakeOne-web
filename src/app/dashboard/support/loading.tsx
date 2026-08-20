import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function SupportLoading() {
  return (
    <PageContainer
      pageTitle='CS 문의'
      pageDescription='등록한 문의의 진행 상태를 확인하고 새 문의를 작성할 수 있습니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
