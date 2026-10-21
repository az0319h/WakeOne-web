import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { WorkflowActorStatus, WorkflowDocumentDetail, WorkflowStepStatus } from '../api/types';
import { WORKFLOW_NOTIFICATION_SETTING_LABELS } from '../lib/approval-line-rules';
import { WorkflowPersonInfo } from './workflow-person';

const STEP_LABEL: Record<WorkflowStepStatus, string> = {
  ONGOING: '진행 중',
  PENDING: '대기중',
  APPROVED: '완료',
  DECLINED: '반려'
};

const STEP_CLASS: Record<WorkflowStepStatus, string> = {
  ONGOING: 'font-medium text-primary',
  PENDING: 'text-muted-foreground',
  APPROVED: 'text-muted-foreground',
  DECLINED: 'font-medium text-destructive'
};

function ActorStatusBadge({ status }: { status: WorkflowActorStatus }) {
  if (status === 'APPROVED') {
    return (
      <Badge className='shrink-0 gap-1 rounded-full border-transparent bg-green-500/10 font-normal text-green-700 shadow-none dark:text-green-400'>
        <Icons.check aria-hidden className='size-3' />
        승인
      </Badge>
    );
  }
  if (status === 'DECLINED') {
    return (
      <Badge className='shrink-0 rounded-full border-transparent bg-destructive/10 font-normal text-destructive shadow-none'>
        반려
      </Badge>
    );
  }
  return (
    <Badge variant='outline' className='shrink-0 rounded-full font-normal text-muted-foreground'>
      대기중
    </Badge>
  );
}

function ViewSectionHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className='flex min-h-8 items-center gap-2'>
      <h4 className={cn('shrink-0 text-sm', className)}>{title}</h4>
      <div aria-hidden className='h-px flex-1 bg-border' />
    </div>
  );
}

/** 상세 「승인 · 참조」 읽기 전용 (편집용 testid 없음 — designer §10 참고) */
export function WorkflowApprovalLineView({
  document,
  showTitle = true
}: {
  document: Pick<WorkflowDocumentDetail, 'steps' | 'referrers'>;
  showTitle?: boolean;
}) {
  const steps = [...document.steps].sort((a, b) => a.step - b.step);
  return (
    <div className='flex flex-col gap-5'>
      {showTitle ? <h3 className='text-sm font-semibold'>승인 · 참조</h3> : null}
      {document.referrers.length > 0 ? (
        <section aria-label='참조' className='flex flex-col gap-1'>
          <ViewSectionHeader title='참조' className='text-muted-foreground' />
          <ul className='flex flex-col'>
            {document.referrers.map((referrer) => (
              <li key={referrer.user_id} className='flex min-h-12 items-center gap-2'>
                <WorkflowPersonInfo person={referrer} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant='outline' className='shrink-0 gap-1 rounded-full font-normal' tabIndex={0}>
                      <Icons.notification aria-hidden className='size-3' />
                      참조
                      <span className='sr-only'>
                        ({WORKFLOW_NOTIFICATION_SETTING_LABELS[referrer.notification_setting]})
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {WORKFLOW_NOTIFICATION_SETTING_LABELS[referrer.notification_setting]}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {steps.map((step) => (
        <section key={step.step} aria-label={`${step.step} 단계`} className='flex flex-col gap-1'>
          <ViewSectionHeader
            title={`${step.step} 단계 ${STEP_LABEL[step.status]}`}
            className={STEP_CLASS[step.status]}
          />
          <ul className='flex flex-col'>
            {step.actors.map((actor) => (
              <li key={actor.user_id} className='flex min-h-12 items-center gap-2'>
                <WorkflowPersonInfo person={actor} />
                <ActorStatusBadge status={actor.status} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
