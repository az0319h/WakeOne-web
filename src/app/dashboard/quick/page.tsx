import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { buildQuickRequestViewer } from '@/features/quick-request/api/workflow.server';
import { QuickDashboardPage } from '@/features/quick-request/components/dashboard/quick-dashboard-page';
import { quickInfoContent } from '@/features/quick-request/info-content';
import { resolveQuickScopeTopic } from '@/features/quick-request/lib/quick-realtime-topics';

/** plan 97 AC-10 — 기간은 목록 위에서 선택 (기본 최근 7일 · `quickRangeLabel`이 메타바에 표시) */
const QUICK_DASHBOARD_DESCRIPTION = '한국 시간 기준 · 오늘 포함 · 조회 기간은 목록 위에서 선택합니다';

/** plan 89 — 퀵 대시보드. 목록은 클라이언트에서 조회한다(서버 prefetch 없음 · workflow와 같음) */
export default async function QuickDashboardRoute() {
  const profile = await requireDashboardSession();
  const viewer = buildQuickRequestViewer(profile);

  return (
    <PageContainer
      mobileHeader='hidden'
      pageTitle={viewer.scope === 'all' ? '퀵 내역' : '나의 퀵 내역'}
      pageDescription={QUICK_DASHBOARD_DESCRIPTION}
      infoContent={quickInfoContent}
      pageHeaderAction={
        viewer.canCreate ? (
          <Button className='h-11 md:h-10' asChild>
            <Link href='/dashboard/quick/request' data-testid='quick-request-new-button'>
              <Icons.add aria-hidden />
              퀵 요청하기
            </Link>
          </Button>
        ) : undefined
      }
    >
      <QuickDashboardPage
        canCreate={viewer.canCreate}
        realtimeTopic={resolveQuickScopeTopic({ scope: viewer.scope, userId: profile.user_id })}
      />
    </PageContainer>
  );
}
