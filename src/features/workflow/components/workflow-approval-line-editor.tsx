'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { WorkflowMember } from '../api/types';
import {
  isWorkflowNotificationSetting,
  WORKFLOW_NOTIFICATION_SETTING_LABELS,
  WORKFLOW_NOTIFICATION_SETTINGS,
  type WorkflowNotificationSetting
} from '../lib/approval-line-rules';
import type { WorkflowLineStep, WorkflowLineValue } from '../lib/approval-line-state';
import { WorkflowMemberCombobox } from './workflow-member-combobox';
import { WorkflowPersonInfo } from './workflow-person';

export type WorkflowApprovalLineEditorMode = 'compose' | 'change' | 'policy';

const NOTIFY_PILL_LABELS: Record<WorkflowNotificationSetting, string> = {
  START_AND_END: '알림',
  END: '완료 알림',
  NONE: '알림 없음'
};

function SectionHeader({
  title,
  className,
  actions
}: {
  title: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className='flex min-h-9 items-center gap-2'>
      <h4 className={cn('shrink-0 text-sm text-muted-foreground', className)}>{title}</h4>
      <div aria-hidden className='h-px min-w-4 flex-1 bg-border' />
      {actions}
    </div>
  );
}

function ReferrerNotifyMenu({
  userId,
  value,
  onChange
}: {
  userId: string;
  value: WorkflowNotificationSetting;
  onChange: (next: WorkflowNotificationSetting) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          data-testid={`workflow-referrer-notify-${userId}`}
          aria-label={`알림 설정: ${WORKFLOW_NOTIFICATION_SETTING_LABELS[value]}`}
          className='h-8 shrink-0 gap-1 rounded-full px-2.5 text-xs'
        >
          <Icons.notification aria-hidden className='size-3.5' />
          {NOTIFY_PILL_LABELS[value]}
          <Icons.chevronDown aria-hidden className='size-3.5' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        <DropdownMenuLabel>알림 설정</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (isWorkflowNotificationSetting(next)) onChange(next);
          }}
        >
          {WORKFLOW_NOTIFICATION_SETTINGS.map((setting) => (
            <DropdownMenuRadioItem key={setting} value={setting}>
              {WORKFLOW_NOTIFICATION_SETTING_LABELS[setting]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className='flex items-start gap-1.5 px-2 py-1.5 text-xs text-muted-foreground'>
          <Icons.info aria-hidden className='mt-0.5 size-3.5 shrink-0' />
          댓글 알림은 설정과 관계없이 수신돼요.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type WorkflowApprovalLineEditorProps = {
  value: WorkflowLineValue;
  onChange: (next: WorkflowLineValue) => void;
  mode: WorkflowApprovalLineEditorMode;
  /** compose·change: 작성자는 승인자로 지정할 수 없다 */
  writerId?: string | null;
  error?: string | null;
  /** 「승인 · 참조」 제목 표시 (policy는 섹션 제목이 대신함) */
  showTitle?: boolean;
  className?: string;
};

/** 참조 / n 단계 승인 / 「＋ 승인 단계 추가하기」 (designer §5.1) */
export function WorkflowApprovalLineEditor({
  value,
  onChange,
  mode,
  writerId,
  error,
  showTitle = mode !== 'policy',
  className
}: WorkflowApprovalLineEditorProps) {
  const approverIds = new Set(value.steps.flatMap((step) => step.actors.map((actor) => actor.member.user_id)));
  const referrerIds = new Set(value.referrers.map((referrer) => referrer.member.user_id));

  function approverDisabledReason(member: WorkflowMember): string | null {
    if (mode !== 'policy' && writerId && member.user_id === writerId) return '작성자';
    if (approverIds.has(member.user_id)) return '이미 지정됨';
    return null;
  }

  function updateStep(index: number, updater: (step: WorkflowLineStep) => WorkflowLineStep) {
    onChange({
      ...value,
      steps: value.steps.map((step, stepIndex) => (stepIndex === index ? updater(step) : step))
    });
  }

  function addApprover(index: number, member: WorkflowMember) {
    if (approverDisabledReason(member)) return;
    updateStep(index, (step) => ({ ...step, actors: [...step.actors, { member }] }));
  }

  function removeApprover(index: number, userId: string) {
    updateStep(index, (step) => ({
      ...step,
      actors: step.actors.filter((actor) => actor.member.user_id !== userId)
    }));
  }

  function removeStep(index: number) {
    onChange({ ...value, steps: value.steps.filter((_, stepIndex) => stepIndex !== index) });
  }

  function addStep() {
    onChange({ ...value, steps: [...value.steps, { actors: [] }] });
  }

  function addReferrer(member: WorkflowMember) {
    if (referrerIds.has(member.user_id)) return;
    onChange({
      ...value,
      referrers: [...value.referrers, { member, notification_setting: 'START_AND_END' }]
    });
  }

  function updateReferrer(userId: string, setting: WorkflowNotificationSetting) {
    onChange({
      ...value,
      referrers: value.referrers.map((referrer) =>
        referrer.member.user_id === userId ? { ...referrer, notification_setting: setting } : referrer
      )
    });
  }

  function removeReferrer(userId: string) {
    onChange({
      ...value,
      referrers: value.referrers.filter((referrer) => referrer.member.user_id !== userId)
    });
  }

  return (
    <div data-testid='workflow-approval-line' className={cn('flex flex-col gap-5', className)}>
      {showTitle ? <h3 className='text-sm font-semibold'>승인 · 참조</h3> : null}

      <section data-testid='workflow-referrers' aria-label='참조' className='flex flex-col gap-1'>
        <SectionHeader
          title='참조'
          actions={
            <WorkflowMemberCombobox
              onSelect={addReferrer}
              getDisabledReason={(member) => (referrerIds.has(member.user_id) ? '이미 지정됨' : null)}
            >
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='참조자 추가'
                data-testid='workflow-referrer-add'
                className='size-9 shrink-0'
              >
                <Icons.add aria-hidden />
              </Button>
            </WorkflowMemberCombobox>
          }
        />
        {value.referrers.length === 0 ? (
          <p className='text-xs text-muted-foreground'>참조자가 없습니다.</p>
        ) : (
          <ul className='flex flex-col'>
            {value.referrers.map((referrer) => (
              <li key={referrer.member.user_id} className='flex min-h-12 items-center gap-2'>
                <WorkflowPersonInfo person={referrer.member} />
                <ReferrerNotifyMenu
                  userId={referrer.member.user_id}
                  value={referrer.notification_setting}
                  onChange={(next) => updateReferrer(referrer.member.user_id, next)}
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={`${referrer.member.full_name} 참조 해제`}
                  className='size-9 shrink-0 text-muted-foreground'
                  onClick={() => removeReferrer(referrer.member.user_id)}
                >
                  <Icons.close aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {value.steps.map((step, index) => {
        const n = index + 1;
        const locked = mode === 'change' && step.status === 'APPROVED';
        const hasApproved = step.actors.some((actor) => actor.approved);
        const canDeleteStep = !locked && !hasApproved && (value.steps.length > 1 || mode === 'policy');
        return (
          <section
            key={`step-${n}`}
            data-testid={`workflow-step-${n}`}
            aria-label={`${n} 단계 승인`}
            className='flex flex-col gap-1'
          >
            <SectionHeader
              title={
                locked ? (
                  <span className='inline-flex items-center gap-1'>
                    {n} 단계 완료
                    <Icons.lock aria-hidden className='size-3.5' />
                  </span>
                ) : (
                  `${n} 단계 승인`
                )
              }
              actions={
                locked ? null : (
                  <>
                    <WorkflowMemberCombobox
                      onSelect={(member) => addApprover(index, member)}
                      getDisabledReason={approverDisabledReason}
                    >
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={`${n}단계 승인자 추가`}
                        data-testid={`workflow-step-${n}-add`}
                        className='size-9 shrink-0'
                      >
                        <Icons.add aria-hidden />
                      </Button>
                    </WorkflowMemberCombobox>
                    {canDeleteStep ? (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={`${n}단계 삭제`}
                        className='size-9 shrink-0 text-muted-foreground'
                        onClick={() => removeStep(index)}
                      >
                        <Icons.trash aria-hidden />
                      </Button>
                    ) : null}
                  </>
                )
              }
            />
            {step.actors.length === 0 ? (
              <WorkflowMemberCombobox
                onSelect={(member) => addApprover(index, member)}
                getDisabledReason={approverDisabledReason}
                align='start'
              >
                <Button
                  type='button'
                  variant='outline'
                  className='h-11 w-full border-dashed font-normal text-muted-foreground'
                >
                  승인자를 추가해 주세요.
                </Button>
              </WorkflowMemberCombobox>
            ) : (
              <ul className='flex flex-col'>
                {step.actors.map((actor) => (
                  <li
                    key={actor.member.user_id}
                    data-testid={`workflow-actor-${n}-${actor.member.user_id}`}
                    className='flex min-h-12 items-center gap-2'
                  >
                    <WorkflowPersonInfo person={actor.member} />
                    {actor.approved ? (
                      <Badge className='shrink-0 gap-1 rounded-full border-transparent bg-green-500/10 font-normal text-green-700 shadow-none dark:text-green-400'>
                        <Icons.check aria-hidden className='size-3' />
                        승인
                      </Badge>
                    ) : (
                      <Badge variant='secondary' className='shrink-0 rounded-full font-normal'>
                        승인
                      </Badge>
                    )}
                    {locked || actor.approved ? null : (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={`${actor.member.full_name} 승인자 제거`}
                        className='size-9 shrink-0 text-muted-foreground'
                        onClick={() => removeApprover(index, actor.member.user_id)}
                      >
                        <Icons.close aria-hidden />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Button
        type='button'
        variant='secondary'
        data-testid='workflow-step-add'
        className='h-11 w-full'
        onClick={addStep}
      >
        <Icons.add aria-hidden />
        승인 단계 추가하기
      </Button>

      {error ? (
        <p role='alert' data-invalid='true' className='text-sm text-destructive'>
          {error}
        </p>
      ) : null}
    </div>
  );
}
