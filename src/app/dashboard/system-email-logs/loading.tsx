import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='독촉 이메일 로그'
      pageDescription='계약서 첨부 누락 독촉 등 시스템 발송 이메일 run 이력을 확인합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
