import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

/** 역할을 모르므로 제목은 「퀵 내역」 (designer K9) */
export default function Loading() {
  return (
    <PageContainer
      mobileHeader='hidden'
      pageTitle='퀵 내역'
      pageDescription='한국 시간 기준 · 오늘 포함 · 조회 기간은 목록 위에서 선택합니다'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
