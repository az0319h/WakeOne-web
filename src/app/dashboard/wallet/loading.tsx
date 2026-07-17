import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';

export default function WalletLoading() {
  return (
    <PageContainer
      pageTitle='지갑'
      pageDescription='잔액 충전, 거래 내역, 자동 충전 설정을 관리합니다.'
    >
      <div className='mx-auto flex w-full max-w-5xl flex-1 flex-col'>
        <PageLoadingSpinner variant='fill' />
      </div>
    </PageContainer>
  );
}
