import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { buildQuickRequestViewer } from '@/features/quick-request/api/workflow.server';
import { QuickDashboardPage } from '@/features/quick-request/components/dashboard/quick-dashboard-page';
import { quickInfoContent } from '@/features/quick-request/info-content';

const QUICK_DASHBOARD_DESCRIPTION = '최근 7일 기준 · 한국 시간, 오늘 포함';

/** plan 89 — 퀵 대시보드. 목록은 클라이언트에서 조회한다(서버 prefetch 없음 · workflow와 같음) */
export default async function QuickDashboardRoute() {
  const profile = await requireDashboardSession();
  const viewer = buildQuickRequestViewer(profile);

  return (
    <PageContainer
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
      <QuickDashboardPage canCreate={viewer.canCreate} />
    </PageContainer>
  );
}
