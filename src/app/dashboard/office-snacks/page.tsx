import PageContainer from '@/components/layout/page-container';
import { requireOfficeSnacksPage } from '@/features/auth/api/session.server';
import OfficeSnacksListing from '@/features/office-snacks/components/office-snacks-listing';

export const metadata = {
  title: 'Dashboard: 사무실 간식'
};

export default async function OfficeSnacksPage() {
  await requireOfficeSnacksPage();
  return (
    <PageContainer
      pageTitle='사무실 간식'
      pageDescription='회차를 확인하고 간식 등록, 투표, 결과를 관리합니다.'
    >
      <OfficeSnacksListing />
    </PageContainer>
  );
}
