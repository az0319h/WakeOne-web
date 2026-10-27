'use client';

import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { acceptQuickRequestMutation } from '../../api/mutations';
import type { QuickRequestListRow } from '../../api/types';
import {
  notifyQuickOpenchatOutcome,
  notifyQuickRequestError
} from '../../lib/quick-request-mutation-feedback';

export type QuickRequestRowActionHandlers = {
  onDispatch: (row: QuickRequestListRow) => void;
  onSetFinal: (row: QuickRequestListRow) => void;
  onApprove: (row: QuickRequestListRow) => void;
};

type QuickRequestRowActionProps = QuickRequestRowActionHandlers & {
  row: QuickRequestListRow;
  /** 표(lg↑ h-9) · 모바일 카드(h-11 · 꽉 채움) */
  layout: 'table' | 'card';
  /** `quick-row-action-{no}` · `quick-card-action-{no}` */
  testId: string;
};

type ResolvedAction = 'accept' | 'dispatch' | 'setFinal' | 'approve' | 'awaitingFinal' | null;

/** 서버 `actions` 중 첫 번째 하나만 (designer §2.5) */
export function resolveQuickRowAction(row: QuickRequestListRow): ResolvedAction {
  if (row.actions.accept) return 'accept';
  if (row.actions.dispatch) return 'dispatch';
  if (row.actions.setFinal) return 'setFinal';
  if (row.actions.approve) return row.finalAmount != null ? 'approve' : 'awaitingFinal';
  return null;
}

export function QuickRequestRowAction({
  row,
  layout,
  testId,
  onDispatch,
  onSetFinal,
  onApprove
}: QuickRequestRowActionProps) {
  const acceptMutation = useMutation({ ...acceptQuickRequestMutation });
  const action = resolveQuickRowAction(row);
  const buttonClass = cn(layout === 'card' ? 'h-11 w-full' : 'h-9');

  if (action === null) {
    return (
      <span data-testid={testId} className='text-sm text-muted-foreground'>
        —
      </span>
    );
  }

  if (action === 'awaitingFinal') {
    return (
      <span
        data-testid={testId}
        className={cn(
          'text-xs text-muted-foreground',
          layout === 'card' && 'flex h-11 items-center justify-center'
        )}
      >
        최종금액 대기
      </span>
    );
  }

  if (action === 'accept') {
    return (
      <Button
        type='button'
        className={buttonClass}
        data-testid={testId}
        isLoading={acceptMutation.isPending}
        aria-label={`${row.requestNo} 접수`}
        onClick={() =>
          acceptMutation.mutate(row.requestNo, {
            onSuccess: (result) => {
              notifySuccess('퀵 요청을 접수했습니다.');
              notifyQuickOpenchatOutcome(result.openchat);
            },
            onError: (error) => {
              notifyQuickRequestError(error);
            }
          })
        }
      >
        <Icons.check aria-hidden />
        접수
      </Button>
    );
  }

  if (action === 'dispatch') {
    return (
      <Button
        type='button'
        className={buttonClass}
        data-testid={testId}
        aria-label={`${row.requestNo} 배차완료`}
        onClick={() => onDispatch(row)}
      >
        <Icons.circleCheck aria-hidden />
        배차완료
      </Button>
    );
  }

  if (action === 'setFinal') {
    return (
      <Button
        type='button'
        variant='outline'
        className={buttonClass}
        data-testid={testId}
        aria-label={`${row.requestNo} 최종금액 입력`}
        onClick={() => onSetFinal(row)}
      >
        <Icons.currencyWon aria-hidden />
        최종금액 입력
      </Button>
    );
  }

  return (
    <Button
      type='button'
      className={buttonClass}
      data-testid={testId}
      aria-label={`${row.requestNo} 승인`}
      onClick={() => onApprove(row)}
    >
      <Icons.check aria-hidden />
      승인
    </Button>
  );
}
