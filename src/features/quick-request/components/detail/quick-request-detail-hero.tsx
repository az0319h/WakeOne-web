import { Card } from '@/components/ui/card';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { QuickRequestDetail } from '../../api/types';
import { QuickMobileInfoButton } from '../mobile/quick-mobile-info-button';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QuickRequestCancelledBanner } from './quick-request-cancelled-banner';
import { QuickRequestStatusSummary } from './quick-request-status-summary';
import { QuickRequestStepper } from './quick-request-stepper';

type QuickRequestDetailHeroProps = {
  detail: QuickRequestDetail;
  /**
   * `mobile`(plan 106 D-15 ① · designer §6.2 ①): 휴대폰 상태 카드 — 번호·상태·ⓘ / 지금 상태 한 문장 / 스테퍼(시각 두 줄).
   * 「요청 {시각}」 줄은 없다(요청 시각은 스테퍼 1단계 한 곳 · AC-46). `default`는 PC 지금 화면 그대로.
   */
  variant?: 'default' | 'mobile';
};

function RequestNoHeading({ requestNo }: { requestNo: string }) {
  return (
    <h2
      translate='no'
      data-testid='quick-detail-request-no'
      className='text-xl font-semibold text-foreground tabular-nums'
    >
      {requestNo}
    </h2>
  );
}

function QuickRequestDetailHeroMobile({ detail }: { detail: QuickRequestDetail }) {
  const isCancelled = detail.status === 'cancelled';
  return (
    <Card className='min-w-0 gap-4 px-3 py-4 shadow-none'>
      <div className='flex min-w-0 flex-col gap-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1'>
            <RequestNoHeading requestNo={detail.requestNo} />
            <QuickRequestStatusBadge status={detail.status} size='lg' data-testid='quick-detail-status' />
          </div>
          <QuickMobileInfoButton className='-mr-1.5 shrink-0' />
        </div>
        <QuickRequestStatusSummary detail={detail} />
      </div>
      {isCancelled ? (
        <QuickRequestCancelledBanner history={detail.history} variant='compact' />
      ) : (
        <QuickRequestStepper detail={detail} variant='mobile' />
      )}
    </Card>
  );
}

/** 요청번호 · 상태 · 요청 시각 · Stepper(또는 취소 배너) */
export function QuickRequestDetailHero({ detail, variant = 'default' }: QuickRequestDetailHeroProps) {
  if (variant === 'mobile') {
    return <QuickRequestDetailHeroMobile detail={detail} />;
  }

  return (
    <Card className='min-w-0 gap-5 px-4 py-5 shadow-none sm:px-6'>
      <div className='flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <RequestNoHeading requestNo={detail.requestNo} />
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
