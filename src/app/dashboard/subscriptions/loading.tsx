import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

/** 헤더는 그대로 · 추가 버튼은 권한을 모르니 생략 (designer §2-1) */
export default function SubscriptionsLoading() {
  return (
    <PageContainer
      pageTitle='구독 관리'
      pageDescription='회사가 돈을 내는 툴·서비스와, 누가 쓰는지를 한곳에서 봅니다. 줄을 누르면 자세히 보고 요청할 수 있어요.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
