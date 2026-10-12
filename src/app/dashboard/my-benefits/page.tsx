import { redirect } from "next/navigation";
import PageContainer from "@/components/layout/page-container";
import { requireDashboardSession } from "@/features/auth/api/session.server";
import { MyBenefitsDashboard } from "@/features/benefits/components/my-benefits-dashboard";

export default async function MyBenefitsPage() {
  const profile = await requireDashboardSession();
  if (profile.system_role !== "user") {
    redirect("/dashboard/overview");
  }

  return (
    <PageContainer
      pageTitle="내 복지비 사용 현황"
      pageDescription="월별 10만원 예산과 신청 내역을 확인합니다."
    >
      <MyBenefitsDashboard
        fullName={profile.full_name ?? ""}
        team={profile.rank}
        positionLevel={profile.position_level}
      />
    </PageContainer>
  );
}
