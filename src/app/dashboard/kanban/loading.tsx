import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function Loading() {
  return (
    <PageContainer
      viewportFill
      pageTitle='칸반'
      pageDescription='Google Tasks 목록을 칸반 보드에서 관리합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
