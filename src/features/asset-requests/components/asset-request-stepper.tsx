import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { ASSET_REQUEST_STATUS_LABELS, type AssetRequestStatus } from '../api/types';

const STEPS = ['pending', 'in_progress', 'completed'] as const;
type Step = (typeof STEPS)[number];
type StepState = 'complete' | 'current' | 'upcoming';

function stepStates(status: AssetRequestStatus, hasAssignee: boolean): Record<Step, StepState> {
  switch (status) {
    case 'pending':
      return { pending: 'current', in_progress: 'upcoming', completed: 'upcoming' };
    case 'in_progress':
      return { pending: 'complete', in_progress: 'current', completed: 'upcoming' };
    case 'completed':
      return { pending: 'complete', in_progress: 'complete', completed: 'complete' };
    default:
      // 반려·취소 — 처리중을 거쳤는지는 담당자 유무로 판단(반려는 담당자를 바꾸지 않음 · designer B-6)
      return {
        pending: 'complete',
        in_progress: hasAssignee ? 'complete' : 'upcoming',
        completed: 'upcoming'
      };
  }
}

type AssetRequestStepperProps = {
  status: AssetRequestStatus;
  hasAssignee: boolean;
};

/**
 * 단계 표시 (`asset-request-stepper` · designer §2-5-3) — 접수대기 → 처리중 → 완료.
 * 반려·취소는 정상 다음 단계처럼 보이지 않게 끝 상태 칸으로만 따로 표시(C-6).
 */
export function AssetRequestStepper({ status, hasAssignee }: AssetRequestStepperProps) {
  const states = stepStates(status, hasAssignee);
  const terminal = status === 'rejected' || status === 'canceled' ? status : null;

  return (
    <ol
      aria-label='진행 단계'
      data-testid='asset-request-stepper'
      className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm'
    >
      {STEPS.map((step, index) => {
        const state = states[step];
        return (
          <li
            key={step}
            data-testid={`asset-request-step-${step}`}
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            className='flex items-center gap-2'
          >
            {index > 0 ? (
              <span
                aria-hidden
                className={cn(
                  'h-px w-4 sm:w-8',
                  state === 'complete' || state === 'current' ? 'bg-primary' : 'bg-border'
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                'flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                state === 'complete' && 'bg-primary text-primary-foreground',
                state === 'current' && 'border-2 border-primary text-primary',
                state === 'upcoming' && 'border text-muted-foreground'
              )}
            >
              {state === 'complete' ? <Icons.check className='size-3.5' /> : index + 1}
            </span>
            <span
              className={cn(
                'whitespace-nowrap',
                state === 'upcoming' ? 'text-muted-foreground' : 'font-medium text-foreground'
              )}
            >
              {ASSET_REQUEST_STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
      {terminal ? (
        <li
          data-testid={`asset-request-step-${terminal}`}
          data-state='terminal'
          aria-current='step'
          className='flex items-center gap-2'
        >
          <span aria-hidden className='h-px w-4 bg-border sm:w-8' />
          <span
            aria-hidden
            className={cn(
              'flex size-6 items-center justify-center rounded-full',
              terminal === 'rejected'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {terminal === 'rejected' ? <Icons.ban className='size-3.5' /> : <Icons.xCircle className='size-3.5' />}
          </span>
          <span className='font-medium whitespace-nowrap'>{ASSET_REQUEST_STATUS_LABELS[terminal]}</span>
        </li>
      ) : null}
    </ol>
  );
}
