'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { QuickRequestDetail } from '../../api/types';
import {
  QuickRequestApproveHint,
  QuickRequestPrimaryActionButton,
  resolveQuickDetailPrimaryAction,
  type QuickRequestDetailActionHandlers
} from './quick-request-action-bar';
import { QuickRequestChatLauncher } from './quick-request-chat-launcher';

/** plan 106 designer §6.7 · §9 — 「⋯」 메뉴 항목 44px (ui 기본 `py-1.5`라 className으로만 늘림) */
const MENU_ITEM_CLASS = 'min-h-11 gap-2 text-sm';

type QuickDetailMoreMenuProps = Pick<QuickRequestDetailActionHandlers, 'onEdit' | 'onCancel'> & {
  canEdit: boolean;
  canCancel: boolean;
};

/**
 * 「⋯」(`quick-detail-more`) — 수정 / 구분선 / 요청 취소(마지막 · 빨강).
 * 항목은 메뉴가 열릴 때만 DOM에 생긴다(Radix Portal) → 휴대폰 상세에서 `quick-detail-edit`·`-cancel`은 메뉴를 연 뒤에만 존재.
 * 「요청 취소」 확인은 기존 `QuickCancelAlert`(AlertModal) · 「수정」은 기존 수정 Sheet.
 */
function QuickDetailMoreMenu({ canEdit, canCancel, onEdit, onCancel }: QuickDetailMoreMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-11 shrink-0 touch-manipulation'
          aria-label='더보기'
          data-testid='quick-detail-more'
        >
          <Icons.dots aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side='top' align='end' className='min-w-40'>
        {canEdit ? (
          <DropdownMenuItem className={MENU_ITEM_CLASS} data-testid='quick-detail-edit' onSelect={onEdit}>
            <Icons.edit aria-hidden />
            수정
          </DropdownMenuItem>
        ) : null}
        {canEdit && canCancel ? <DropdownMenuSeparator /> : null}
        {canCancel ? (
          <DropdownMenuItem
            variant='destructive'
            className={MENU_ITEM_CLASS}
            data-testid='quick-detail-cancel'
            onSelect={onCancel}
          >
            <Icons.circleX aria-hidden />
            요청 취소
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type QuickRequestMobileActionBarProps = QuickRequestDetailActionHandlers & {
  detail: QuickRequestDetail;
};

/**
 * plan 106 D-16 · designer §6.7 — lg 미만 상세 하단.
 *
 * | 경우 | 화면 |
 * |---|---|
 * | 주 버튼 + 수정/취소 권한 | `[주 버튼 flex-1][대화 N][⋯]` |
 * | 주 버튼만 | `[주 버튼 flex-1][대화 N]` |
 * | 수정/취소만 | `[대화 N flex-1][⋯]` |
 * | 할 일 없음 | 하단 바 없음 + 오른쪽 아래 떠 있는 「대화」(56px) |
 *
 * 바는 문서 흐름 끝의 `sticky bottom-0` + `data-quick-sticky-bottom`(전역 scroll-padding) + safe-area.
 * PageContainer 아래 여백(`pb-4`)만큼 `-mb-4`로 내려 맨 아래까지 내려도 화면 바닥에 붙는다.
 */
export function QuickRequestMobileActionBar({
  detail,
  onOpenChat,
  onEdit,
  onCancel,
  onDispatch,
  onSetFinal,
  onApprove
}: QuickRequestMobileActionBarProps) {
  const hintId = useId();
  const primary = resolveQuickDetailPrimaryAction(detail);
  const { canEdit, canCancel } = detail.permissions;
  const hasMore = canEdit || canCancel;
  const approveBlocked = primary === 'approve' && detail.finalAmount == null;

  if (!primary && !hasMore) {
    return <QuickRequestChatLauncher requestNo={detail.requestNo} onOpen={onOpenChat} variant='fab' />;
  }

  return (
    <div
      data-testid='quick-detail-actions'
      data-quick-sticky-bottom
      className='sticky bottom-0 z-10 -mx-4 mt-1 -mb-4 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6'
    >
      {approveBlocked ? <QuickRequestApproveHint id={hintId} /> : null}
      <div className='flex min-w-0 items-center gap-2'>
        {primary ? (
          <QuickRequestPrimaryActionButton
            detail={detail}
            primary={primary}
            className='h-11 min-w-0 flex-1 touch-manipulation'
            approveHintId={hintId}
            onDispatch={onDispatch}
            onSetFinal={onSetFinal}
            onApprove={onApprove}
          />
        ) : null}
        <QuickRequestChatLauncher
          requestNo={detail.requestNo}
          onOpen={onOpenChat}
          className={cn('touch-manipulation', primary ? 'shrink-0 px-3' : 'min-w-0 flex-1')}
        />
        {hasMore ? (
          <QuickDetailMoreMenu canEdit={canEdit} canCancel={canCancel} onEdit={onEdit} onCancel={onCancel} />
        ) : null}
      </div>
    </div>
  );
}
