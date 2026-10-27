import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

/** 역할을 모르므로 제목은 「퀵 내역」 (designer K9) */
export default function Loading() {
  return (
    <PageContainer pageTitle='퀵 내역' pageDescription='최근 7일 기준 · 한국 시간, 오늘 포함'>
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
