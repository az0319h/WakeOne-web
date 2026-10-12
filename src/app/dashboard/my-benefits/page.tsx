import PageContainer from "@/components/layout/page-container";
import { requireDashboardSession } from "@/features/auth/api/session.server";
import { MyBenefitsPageContent } from "@/features/benefits/components/my-benefits-page-content";

export default async function MyBenefitsPage() {
  const profile = await requireDashboardSession();

  return (
    <PageContainer
      pageTitle="내 복지비 사용 현황"
      pageDescription="월별 10만원 예산과 신청 내역을 확인합니다."
    >
      <MyBenefitsPageContent
        isAdmin={profile.system_role === "admin"}
        viewerProfile={{
          userId: profile.user_id,
          fullName: profile.full_name ?? "",
          team: profile.rank,
          positionLevel: profile.position_level,
        }}
      />
    </PageContainer>
  );
}
