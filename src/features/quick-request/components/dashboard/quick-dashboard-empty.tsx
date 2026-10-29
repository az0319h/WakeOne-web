import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { QuickDashboardEmptyReason } from './use-quick-dashboard-params';

type QuickDashboardEmptyProps = {
  reason: QuickDashboardEmptyReason;
  canCreate: boolean;
  onResetFilters: () => void;
  /** `period` — 기간을 「전체」로 (URL `range` 변경 · 기존 `setRange` 재사용) */
  onShowAllRange: () => void;
};

const EMPTY_CLASS_NAME =
  'flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center';

/**
 * 표·카드 자리 인라인 빈 상태 3종 (designer §2.6 · AC-32 · mobile-ux 2차 A#6).
 * 검색·상태 0건 → 「조건에 맞는」 · 기간(「전체」 아님) 0건 → 「전체 기간 보기」 · 전체 기간 0건 → 「첫 퀵 요청」.
 */
export function QuickDashboardEmpty({
  reason,
  canCreate,
  onResetFilters,
  onShowAllRange
}: QuickDashboardEmptyProps) {
  if (reason === 'filtered') {
    return (
      <div data-testid='quick-dashboard-empty' data-empty-reason={reason} className={EMPTY_CLASS_NAME}>
        <Icons.search aria-hidden className='size-10 text-muted-foreground' />
        <p className='text-base font-medium text-foreground'>조건에 맞는 퀵 요청이 없습니다.</p>
        <p className='text-sm text-muted-foreground'>검색어나 상태를 바꿔 보세요.</p>
        <Button type='button' variant='outline' className='h-11' onClick={onResetFilters}>
          필터 초기화
        </Button>
      </div>
    );
  }

  if (reason === 'period') {
    return (
      <div data-testid='quick-dashboard-empty' data-empty-reason={reason} className={EMPTY_CLASS_NAME}>
        <Icons.calendar aria-hidden className='size-10 text-muted-foreground' />
        <p className='text-base font-medium text-foreground'>선택한 기간에 들어온 요청이 없습니다.</p>
        <p className='text-sm text-muted-foreground'>기간을 넓히거나 전체 기간으로 확인해 보세요.</p>
        <Button
          type='button'
          variant='outline'
          className='h-11'
          data-testid='quick-dashboard-empty-show-all'
          onClick={onShowAllRange}
        >
          전체 기간 보기
        </Button>
      </div>
    );
  }

  return (
    <div data-testid='quick-dashboard-empty' data-empty-reason={reason} className={EMPTY_CLASS_NAME}>
      <Icons.send aria-hidden className='size-10 text-muted-foreground' />
      <p className='text-base font-medium text-foreground'>첫 퀵 요청을 기다리고 있어요</p>
      <p className='text-sm text-muted-foreground'>
        {canCreate ? '퀵이 필요하면 요청을 등록해 주세요.' : '아직 들어온 퀵 요청이 없습니다.'}
      </p>
      {canCreate ? (
        <Button className='h-11' asChild>
          <Link href='/dashboard/quick/request'>퀵 요청하기</Link>
        </Button>
      ) : null}
    </div>
  );
}
