import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function WalletLoading() {
  return (
    <PageContainer
      pageTitle='식대 카드'
      pageDescription='회사에서 제공하는 식대 체크카드의 이번 달 사용 가능 금액을 확인합니다.'
    >
      <div className='mx-auto flex w-full max-w-5xl flex-1 flex-col'>
        <PageLoadingSpinner variant='fill' />
      </div>
    </PageContainer>
  );
}
