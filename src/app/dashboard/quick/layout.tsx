import { Suspense } from 'react';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { buildQuickRequestViewer } from '@/features/quick-request/api/workflow.server';
import { QuickMobileTabbar } from '@/features/quick-request/components/mobile/quick-mobile-tabbar';
import { QuickBackTracker } from '@/features/quick-request/components/mobile/use-quick-back';

type QuickLayoutProps = {
  children: React.ReactNode;
};

/**
 * plan 106 D-4 · designer §2.7 — 퀵 공통 layout (내역·대화·요청·상세).
 * - `QuickBackTracker`: 퀵 안 기록 깊이 추적 → 화면 안 「뒤로」가 back/replace를 고른다 (§7).
 * - `QuickMobileTabbar`: lg 미만 하단 탭 (문서 흐름 끝 sticky · 탭 화면에서만 그린다).
 * Live presence track은 상위 `dashboard/layout.tsx`에서 상속 (plan 49) — 여기서 추가 금지.
 */
export default async function QuickLayout({ children }: QuickLayoutProps) {
  const profile = await requireDashboardSession();
  const viewer = buildQuickRequestViewer(profile);

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
      <Suspense fallback={null}>
        <QuickBackTracker />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <QuickMobileTabbar canCreate={viewer.canCreate} />
      </Suspense>
    </div>
  );
}
