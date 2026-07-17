import PageContainer from '@/components/layout/page-container';
import { WalletPageContent } from '@/features/wallet/components/wallet-page-content';

export const metadata = {
  title: 'Dashboard: Wallet'
};

export default function WalletPage() {
  return (
    <PageContainer
      pageTitle='지갑'
      pageDescription='잔액 충전, 거래 내역, 자동 충전 설정을 관리합니다.'
    >
      <WalletPageContent />
    </PageContainer>
  );
}
