'use client';

import { useId } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { acceptQuickRequestMutation } from '../../api/mutations';
import type { QuickRequestDetail } from '../../api/types';
import { notifyQuickRequestError } from '../../lib/quick-request-mutation-feedback';
import { QUICK_CHAT_DETAIL_ASIDE_MEDIA_QUERY } from '../chat/quick-chat-constants';
import { useMatchMedia } from '../chat/use-match-media';
import { QuickRequestChatLauncher } from './quick-request-chat-launcher';

export type QuickRequestDetailActionHandlers = {
  /** plan 93 — 「대화 N」 (xl 미만) */
  onOpenChat: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDispatch: () => void;
  onSetFinal: () => void;
  onApprove: () => void;
};

export type QuickDetailPrimaryAction = 'accept' | 'dispatch' | 'setFinal' | 'approve' | null;

/** 주 동작은 하나만 — 접수 → 배차완료 → 최종금액 입력(금액 없음) → 승인 (designer §3.4) */
export function resolveQuickDetailPrimaryAction(detail: QuickRequestDetail): QuickDetailPrimaryAction {
  const { permissions } = detail;
  if (permissions.canAccept) return 'accept';
  if (permissions.canDispatch) return 'dispatch';
  if (permissions.canSetFinal && detail.finalAmount == null) return 'setFinal';
  if (permissions.canApprove) return 'approve';
  return null;
}

export function hasQuickDetailActions(detail: QuickRequestDetail): boolean {
  return (
    resolveQuickDetailPrimaryAction(detail) !== null ||
    detail.permissions.canEdit ||
    detail.permissions.canCancel
  );
}

type QuickRequestPrimaryActionButtonProps = Pick<
  QuickRequestDetailActionHandlers,
  'onDispatch' | 'onSetFinal' | 'onApprove'
> & {
  detail: QuickRequestDetail;
  primary: Exclude<QuickDetailPrimaryAction, null>;
  className?: string;
  /** 승인 막힘 안내 `<p>`의 id (승인 버튼 `aria-describedby`) */
  approveHintId?: string;
};

/**
 * 주 동작 버튼 1개 — 접수 / 배차완료 / 최종금액 입력 / 승인. PC 액션바·휴대폰 하단 바(plan 106) 공용.
 * 접수는 Dialog 없이 바로 `acceptQuickRequestMutation` (캐시 무효화는 `mutations.ts` `onSettled`).
 */
export function QuickRequestPrimaryActionButton({
  detail,
  primary,
  className,
  approveHintId,
  onDispatch,
  onSetFinal,
  onApprove
}: QuickRequestPrimaryActionButtonProps) {
  const acceptMutation = useMutation({ ...acceptQuickRequestMutation });
  const approveBlocked = primary === 'approve' && detail.finalAmount == null;

  function handleAccept() {
    acceptMutation.mutate(detail.requestNo, {
      onSuccess: () => {
        notifySuccess('퀵 요청을 접수했습니다.');
      },
      onError: (error) => {
        notifyQuickRequestError(error);
      }
    });
  }

  if (primary === 'accept') {
    return (
      <Button
        type='button'
        className={className}
        data-testid='quick-detail-accept'
        isLoading={acceptMutation.isPending}
        onClick={handleAccept}
      >
        <Icons.check aria-hidden />
        접수
      </Button>
    );
  }
  if (primary === 'dispatch') {
    return (
      <Button type='button' className={className} data-testid='quick-detail-dispatch' onClick={onDispatch}>
        <Icons.circleCheck aria-hidden />
        배차완료
      </Button>
    );
  }
  if (primary === 'setFinal') {
    return (
      <Button type='button' className={className} data-testid='quick-detail-set-final' onClick={onSetFinal}>
        <Icons.currencyWon aria-hidden />
        최종금액 입력
      </Button>
    );
  }
  return (
    <Button
      type='button'
      className={className}
      data-testid='quick-detail-approve'
      disabled={approveBlocked}
      aria-describedby={approveBlocked ? approveHintId : undefined}
      onClick={onApprove}
    >
      <Icons.check aria-hidden />
      승인
    </Button>
  );
}

type QuickRequestApproveHintProps = {
  id: string;
};

/** 승인 막힘 안내 — 「최종금액이 입력되면 승인할 수 있습니다.」 (PC 액션바·휴대폰 하단 바 공용) */
export function QuickRequestApproveHint({ id }: QuickRequestApproveHintProps) {
  return (
    <p
      id={id}
      data-testid='quick-detail-approve-hint'
      className='flex items-center gap-1.5 text-sm text-muted-foreground'
    >
      <Icons.info aria-hidden className='size-4 shrink-0' />
      최종금액이 입력되면 승인할 수 있습니다.
    </p>
  );
}

type QuickRequestActionBarProps = QuickRequestDetailActionHandlers & {
  detail: QuickRequestDetail;
};

const BUTTON_CLASS = 'h-11 lg:h-10';

/**
 * 하단 고정 액션바 — 최대 3버튼 (요청 취소 · 수정 · 주 동작) + plan 93 「대화 N」(xl 미만).
 * 액션이 없어도 xl 미만에서는 「대화」 때문에 렌더한다 (모든 역할 · 읽기 전용은 뷰 안에서 안내).
 * plan 106 — **lg 이상(PC) 상세 트리에서만** 쓴다. lg 미만은 `QuickRequestMobileActionBar`(주 버튼 + 대화 + ⋯).
 */
export function QuickRequestActionBar({
  detail,
  onOpenChat,
  onEdit,
  onCancel,
  onDispatch,
  onSetFinal,
  onApprove
}: QuickRequestActionBarProps) {
  const hintId = useId();
  const primary = resolveQuickDetailPrimaryAction(detail);
  const { canEdit, canCancel } = detail.permissions;
  const approveBlocked = primary === 'approve' && detail.finalAmount == null;
  const hasActions = hasQuickDetailActions(detail);
  // xl 이상은 대화가 aside 카드에 있으므로 액션이 없으면 액션바 자체를 그리지 않는다 (plan 89 AC-23·26 「액션바 사라짐」 유지).
  // hydration 전(false)에는 `xl:hidden`이 같은 결과를 낸다.
  const isXl = useMatchMedia(QUICK_CHAT_DETAIL_ASIDE_MEDIA_QUERY);

  if (!hasActions && isXl) {
    return null;
  }

  return (
    <div
      data-testid='quick-detail-actions'
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6',
        !hasActions && 'xl:hidden'
      )}
    >
      {approveBlocked ? <QuickRequestApproveHint id={hintId} /> : null}
      <div className='flex min-w-0 items-center gap-2'>
        <QuickRequestChatLauncher requestNo={detail.requestNo} onOpen={onOpenChat} className='xl:hidden' />
        {canCancel ? (
          <Button
            type='button'
            variant='ghost'
            className={cn(BUTTON_CLASS, 'px-3 text-destructive hover:text-destructive')}
            data-testid='quick-detail-cancel'
            onClick={onCancel}
          >
            <Icons.circleX aria-hidden />
            요청 취소
          </Button>
        ) : null}
        <div className='ml-auto flex min-w-0 flex-1 items-center justify-end gap-2'>
          {canEdit ? (
            <Button
              type='button'
              variant='outline'
              className={BUTTON_CLASS}
              data-testid='quick-detail-edit'
              onClick={onEdit}
            >
              <Icons.edit aria-hidden />
              수정
            </Button>
          ) : null}
          {primary ? (
            <QuickRequestPrimaryActionButton
              detail={detail}
              primary={primary}
              className={cn(BUTTON_CLASS, 'flex-1 sm:flex-none')}
              approveHintId={hintId}
              onDispatch={onDispatch}
              onSetFinal={onSetFinal}
              onApprove={onApprove}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
