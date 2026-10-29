import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

/** 헤더는 그대로 · 추가 버튼은 권한을 모르니 생략 (designer §2-1) */
export default function EquipmentLoading() {
  return (
    <PageContainer
      pageTitle='비품 관리'
      pageDescription='회사 전산장비와 쓰는 사람을 봅니다. 고장·교체·반납은 줄을 눌러 요청하세요.'
    >
      <PageLoadingSpinner variant='fill' />
    </PageContainer>
  );
}
