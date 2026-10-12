import PageContainer from "@/components/layout/page-container";
import { requireAdminPage } from "@/features/auth/api/session.server";
import { BenefitsAdminDashboard } from "@/features/benefits/components/benefits-admin-dashboard";

export default async function BenefitsPage() {
  await requireAdminPage();

  return (
    <PageContainer
      pageTitle="복지비 사용 현황"
      pageDescription="월별 10만원 예산의 신청 내역을 한눈에 확인합니다."
    >
      <BenefitsAdminDashboard />
    </PageContainer>
  );
}
