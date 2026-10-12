import PageContainer from "@/components/layout/page-container";
import { PageLoadingSpinner } from "@/components/ui/page-loading-spinner";

export default function Loading() {
  return (
    <PageContainer
      pageTitle="복지비 사용 현황"
      pageDescription="월별 10만원 예산의 신청 내역을 한눈에 확인합니다."
    >
      <PageLoadingSpinner variant="fill" />
    </PageContainer>
  );
}
