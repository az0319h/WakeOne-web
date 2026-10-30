import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { QuickRequestDetail } from '../../api/types';
import {
  QUICK_REQUEST_STATUS_LABELS,
  QUICK_REQUEST_STEP_ORDER
} from '../../lib/quick-request-status';

type StepStatus = (typeof QUICK_REQUEST_STEP_ORDER)[number];

/** plan 106 — 휴대폰 단계 라벨(짧게 · 한 줄). 상태 Badge·PC 스테퍼는 원래 라벨 그대로 */
const MOBILE_STEP_LABELS: Record<StepStatus, string> = {
  requested: '신규요청',
  dispatching: '접수',
  dispatched: '배차완료',
  approved: '승인'
};

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

/** `yyyy-MM-dd (EEE) HH:mm:ss` → [날짜, `(EEE) HH:mm:ss`] — 휴대폰 두 줄 표시용 (글자는 `formatAbsoluteDateTimeKo` 그대로) */
function splitDateTimeLabel(label: string): [string, string] {
  const index = label.indexOf(' ');
  if (index < 0) return [label, ''];
  return [label.slice(0, index), label.slice(index + 1)];
}

type StepTimeProps = {
  time: string;
  variant: 'default' | 'mobile';
};

function StepTime({ time, variant }: StepTimeProps) {
  const label = formatAbsoluteDateTimeKo(time);
  if (variant === 'mobile') {
    const [date, rest] = splitDateTimeLabel(label);
    // 두 span 사이 실제 공백 → textContent = 전체 시각 문자열 (designer §6.4 · AC-44)
    return (
      <time
        dateTime={time}
        className='flex flex-col text-xs leading-4 text-muted-foreground tabular-nums'
      >
        <span>{date}</span> <span>{rest}</span>
      </time>
    );
  }
  return (
    <time dateTime={time} className='block text-xs text-muted-foreground tabular-nums'>
      {label}
    </time>
  );
}

type QuickRequestStepperProps = {
  detail: QuickRequestDetail;
  /**
   * `mobile`(plan 106 D-15 ① · lg 미만 휴대폰 트리): 짧은 라벨 · 단계별 전체 시각 두 줄 · 칸 사이 간격 0.
   * `default`: PC(lg 이상) 지금 화면 그대로.
   */
  variant?: 'default' | 'mobile';
};

/** 4단계 진행 표시 (시맨틱 토큰만) — 375px에서도 가로 4칸 */
export function QuickRequestStepper({ detail, variant = 'default' }: QuickRequestStepperProps) {
  const currentIndex = QUICK_REQUEST_STEP_ORDER.indexOf(detail.status as StepStatus);
  const isFinished = detail.status === 'approved';
  const isMobile = variant === 'mobile';

  return (
    <ol
      aria-label='진행 단계'
      data-testid='quick-detail-stepper'
      className={cn('grid grid-cols-4', isMobile ? 'gap-0' : 'gap-1')}
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
                  'absolute top-4 left-1/2 h-0.5',
                  isMobile ? 'w-full' : 'w-[calc(100%+0.25rem)]',
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
              {isMobile ? MOBILE_STEP_LABELS[step] : QUICK_REQUEST_STATUS_LABELS[step]}
            </span>
            {time && (isComplete || isCurrent) ? <StepTime time={time} variant={variant} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
