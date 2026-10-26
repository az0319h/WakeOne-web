import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { QuickRequestHistory } from '../../api/types';

type QuickRequestCancelledBannerProps = {
  history: QuickRequestHistory;
};

/** 취소된 요청 — Stepper 대신 표시 */
export function QuickRequestCancelledBanner({ history }: QuickRequestCancelledBannerProps) {
  const actor = history.cancelledBy?.name;
  return (
    <Alert data-testid='quick-detail-cancelled-banner' className='bg-muted/50'>
      <Icons.circleX aria-hidden />
      <AlertTitle>취소된 요청입니다.</AlertTitle>
      <AlertDescription className='gap-1'>
        {actor || history.cancelledAt ? (
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
