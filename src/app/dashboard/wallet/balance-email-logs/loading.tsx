import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function Loading() {
  return (
    <PageContainer
      pageTitle='잔액 확인 이메일 로그'
      pageDescription='식대 잔액 확인 이메일 Cron 발송 run 이력을 확인합니다.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
