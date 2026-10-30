import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { QuickRequestHistory } from '../../api/types';

type QuickRequestCancelledBannerProps = {
  history: QuickRequestHistory;
  /**
   * `compact`(plan 106 · 휴대폰 상태 카드): 바로 위 상태 문장이 「취소된 요청입니다.」를 말하므로 제목을 빼고
   * 누가·언제·사유만 보인다. 보일 내용이 없으면 그리지 않는다. `default`는 지금 화면 그대로(PC).
   */
  variant?: 'default' | 'compact';
};

/** 취소된 요청 — Stepper 대신 표시 */
export function QuickRequestCancelledBanner({
  history,
  variant = 'default'
}: QuickRequestCancelledBannerProps) {
  const actor = history.cancelledBy?.name;
  const hasWho = Boolean(actor || history.cancelledAt);
  const isCompact = variant === 'compact';

  if (isCompact && !hasWho && !history.cancelReason) {
    return null;
  }

  return (
    <Alert data-testid='quick-detail-cancelled-banner' className='bg-muted/50'>
      <Icons.circleX aria-hidden />
      {isCompact ? null : <AlertTitle>취소된 요청입니다.</AlertTitle>}
      <AlertDescription className='gap-1'>
        {hasWho ? (
          <p>
            {actor ? `${actor}님이 ` : ''}
            {history.cancelledAt ? (
              <time dateTime={history.cancelledAt} className='tabular-nums'>
                {formatAbsoluteDateTimeKo(history.cancelledAt)}
              </time>
            ) : null}
            에 취소했습니다.
          </p>
        ) : null}
        {history.cancelReason ? (
          <p className='break-words whitespace-pre-wrap'>사유: {history.cancelReason}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
