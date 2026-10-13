import PageContainer from "@/components/layout/page-container";
import { requireBenefitsAdminPage } from '@/features/auth/api/session.server';
import { BenefitsAdminDashboard } from "@/features/benefits/components/benefits-admin-dashboard";

export default async function BenefitsPage() {
  await requireBenefitsAdminPage();

  return (
    <PageContainer
      pageTitle="복지비 관리"
      pageDescription="구성원별 복지비 사용 현황과 신청 문서를 관리합니다."
    >
      <BenefitsAdminDashboard />
    </PageContainer>
  );
}
