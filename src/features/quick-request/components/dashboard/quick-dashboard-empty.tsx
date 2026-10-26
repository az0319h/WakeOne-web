import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

type QuickDashboardEmptyProps = {
  hasFilters: boolean;
  canCreate: boolean;
  onResetFilters: () => void;
};

/** 표·카드 자리 인라인 빈 상태 2종 (designer §2.6 · AC-32) */
export function QuickDashboardEmpty({ hasFilters, canCreate, onResetFilters }: QuickDashboardEmptyProps) {
  if (hasFilters) {
    return (
      <div
        data-testid='quick-dashboard-empty'
        className='flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center'
      >
        <Icons.search aria-hidden className='size-10 text-muted-foreground' />
        <p className='text-base font-medium text-foreground'>조건에 맞는 퀵 요청이 없습니다.</p>
        <p className='text-sm text-muted-foreground'>검색어나 상태를 바꿔 보세요.</p>
        <Button type='button' variant='outline' className='h-11' onClick={onResetFilters}>
          필터 초기화
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid='quick-dashboard-empty'
      className='flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center'
    >
      <Icons.send aria-hidden className='size-10 text-muted-foreground' />
      <p className='text-base font-medium text-foreground'>첫 퀵 요청을 기다리고 있어요</p>
      <p className='text-sm text-muted-foreground'>
        {canCreate ? '퀵이 필요하면 요청을 등록해 주세요.' : '최근 7일 동안 들어온 요청이 없습니다.'}
      </p>
      {canCreate ? (
        <Button className='h-11' asChild>
          <Link href='/dashboard/quick/request'>퀵 요청하기</Link>
        </Button>
      ) : null}
    </div>
  );
}
