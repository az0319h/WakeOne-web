import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { QuickRequestDetail } from '../../api/types';
import {
  QUICK_REQUEST_STATUS_LABELS,
  QUICK_REQUEST_STEP_ORDER
} from '../../lib/quick-request-status';

type StepStatus = (typeof QUICK_REQUEST_STEP_ORDER)[number];

function getStepTime(detail: QuickRequestDetail, step: StepStatus): string | null {
  switch (step) {
    case 'requested':
      return detail.requestedAt;
    case 'dispatching':
      return detail.history.acceptedAt;
    case 'dispatched':
      return detail.history.dispatchedAt;
    case 'approved':
      return detail.history.approvedAt;
  }
}

type QuickRequestStepperProps = {
  detail: QuickRequestDetail;
};

/** 4단계 진행 표시 (시맨틱 토큰만) — 375px에서도 가로 4칸 */
export function QuickRequestStepper({ detail }: QuickRequestStepperProps) {
  const currentIndex = QUICK_REQUEST_STEP_ORDER.indexOf(detail.status as StepStatus);
  const isFinished = detail.status === 'approved';

  return (
    <ol
      aria-label='진행 단계'
      data-testid='quick-detail-stepper'
      className='grid grid-cols-4 gap-1'
    >
      {QUICK_REQUEST_STEP_ORDER.map((step, index) => {
        const isComplete = index < currentIndex || (isFinished && index === currentIndex);
        const isCurrent = index === currentIndex;
        const isLast = index === QUICK_REQUEST_STEP_ORDER.length - 1;
        const time = getStepTime(detail, step);
        return (
          <li
            key={step}
            data-testid={`quick-detail-step-${step}`}
            data-state={isComplete ? 'complete' : isCurrent ? 'current' : 'upcoming'}
            aria-current={isCurrent ? 'step' : undefined}
            className='relative flex min-w-0 flex-col items-center gap-1.5 text-center'
          >
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  'absolute top-4 left-1/2 h-0.5 w-[calc(100%+0.25rem)]',
                  index < currentIndex ? 'bg-primary' : 'bg-border'
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                isComplete && 'bg-primary text-primary-foreground',
                !isComplete && isCurrent && 'border-2 border-primary bg-background text-primary',
                !isComplete && !isCurrent && 'border bg-background text-muted-foreground'
              )}
            >
              {isComplete ? <Icons.check className='size-4' /> : index + 1}
            </span>
            <span
              className={cn(
                'text-xs break-keep sm:text-sm',
                isCurrent || isComplete ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {QUICK_REQUEST_STATUS_LABELS[step]}
            </span>
            {time && (isComplete || isCurrent) ? (
              <time
                dateTime={time}
                className='hidden text-xs text-muted-foreground tabular-nums sm:block'
              >
                {formatAbsoluteDateTimeKo(time)}
              </time>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
