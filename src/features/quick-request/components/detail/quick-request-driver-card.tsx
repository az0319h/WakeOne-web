import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { formatPhoneDisplay } from '@/lib/phone';
import type { QuickRequestDetail } from '../../api/types';

type QuickRequestDriverCardProps = {
  detail: QuickRequestDetail;
  /**
   * 「전화 걸기」 버튼 모양 (designer K11): 하단 바에 **활성** 주 버튼이 없으면 `default`(primary), 있으면 `outline`.
   * 한 화면에 primary는 하나만.
   */
  callButtonVariant?: 'default' | 'outline';
};

/**
 * plan 106 D-15 ② · designer §6.5 — 휴대폰 기사 카드 (`quick-detail-driver-card`).
 * 기사 이름 · 자동차등록번호 · 「전화 걸기 · 010-…」(44px · `tel:`). PC 「배차 정보」 카드를 휴대폰에서 대신한다
 * (`quick-detail-driver-phone`은 DOM에 한 벌).
 * 배차 전이면 한 줄 안내, 배차 정보 없이 취소된 건이면 그리지 않는다(오해 방지).
 */
export function QuickRequestDriverCard({
  detail,
  callButtonVariant = 'default'
}: QuickRequestDriverCardProps) {
  const { driverName, driverPhone, vehicleInfo } = detail.dispatch;
  const hasDispatch = Boolean(vehicleInfo || driverName || driverPhone);

  if (!hasDispatch) {
    if (detail.status === 'cancelled') return null;
    return (
      <Card data-testid='quick-detail-driver-card' className='min-w-0 gap-0 p-4 shadow-none'>
        <p className='text-sm text-muted-foreground'>배차 완료 후 기사 정보가 표시됩니다.</p>
      </Card>
    );
  }

  return (
    <Card data-testid='quick-detail-driver-card' className='min-w-0 gap-3 p-4 shadow-none'>
      <div className='flex min-w-0 items-center gap-3'>
        <span
          aria-hidden
          className='flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'
        >
          <Icons.user className='size-5' />
        </span>
        <div className='flex min-w-0 flex-1 flex-col'>
          <p className='truncate font-semibold text-foreground'>{driverName ?? '—'}</p>
          <p className='text-xs text-muted-foreground'>배차 기사</p>
        </div>
        {vehicleInfo ? (
          <p
            translate='no'
            data-testid='quick-detail-driver-vehicle'
            className='shrink-0 text-sm font-medium text-foreground tabular-nums'
          >
            <span className='sr-only'>자동차등록번호 </span>
            {vehicleInfo}
          </p>
        ) : null}
      </div>
      {driverPhone ? (
        <Button asChild variant={callButtonVariant} className='h-11 w-full touch-manipulation'>
          <a href={`tel:${driverPhone}`} data-testid='quick-detail-driver-phone'>
            <Icons.phone aria-hidden />
            <span className='truncate'>
              전화 걸기 · <span className='tabular-nums'>{formatPhoneDisplay(driverPhone)}</span>
            </span>
          </a>
        </Button>
      ) : (
        <p data-testid='quick-detail-driver-phone' className='text-sm text-muted-foreground'>
          연락처 없음
        </p>
      )}
    </Card>
  );
}
