import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function WalletLoading() {
  return (
    <PageContainer
      pageTitle='지갑'
      pageDescription='KB국민카드에서 동기화된 월간 한도를 본인 및 선택한 사용자 기준으로 확인합니다.'
    >
      <div className='mx-auto flex w-full max-w-5xl flex-1 flex-col'>
        <PageLoadingSpinner variant='fill' />
      </div>
    </PageContainer>
  );
}
