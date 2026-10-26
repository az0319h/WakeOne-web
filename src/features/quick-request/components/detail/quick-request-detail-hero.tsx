import { Card } from '@/components/ui/card';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { QuickRequestDetail } from '../../api/types';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QuickRequestCancelledBanner } from './quick-request-cancelled-banner';
import { QuickRequestStepper } from './quick-request-stepper';

type QuickRequestDetailHeroProps = {
  detail: QuickRequestDetail;
};

/** 요청번호 · 상태 · 요청 시각 · Stepper(또는 취소 배너) */
export function QuickRequestDetailHero({ detail }: QuickRequestDetailHeroProps) {
  return (
    <Card className='min-w-0 gap-5 px-4 py-5 shadow-none sm:px-6'>
      <div className='flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <h2
            translate='no'
            data-testid='quick-detail-request-no'
            className='text-xl font-semibold text-foreground tabular-nums'
          >
            {detail.requestNo}
          </h2>
          <QuickRequestStatusBadge
            status={detail.status}
            size='lg'
            data-testid='quick-detail-status'
          />
        </div>
        <p className='text-sm text-muted-foreground'>
          요청{' '}
          <time dateTime={detail.requestedAt} className='tabular-nums'>
            {formatAbsoluteDateTimeKo(detail.requestedAt)}
          </time>
        </p>
      </div>
      {detail.status === 'cancelled' ? (
        <QuickRequestCancelledBanner history={detail.history} />
      ) : (
        <QuickRequestStepper detail={detail} />
      )}
    </Card>
  );
}
