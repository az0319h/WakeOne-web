'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { quickRequestMessagesQueryOptions } from '../../api/queries';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY, quickChatText } from './quick-chat-constants';
import {
  QuickChatParticipantsDrawer,
  useQuickChatLeaveNavigation,
  useQuickChatParticipantConfirm
} from './quick-chat-participants-drawer';
import { QuickChatParticipantConfirm, QuickChatParticipantsPanel } from './quick-chat-participants-panel';
import type { QuickRequestConversationVariant } from './quick-request-conversation';
import { useMatchMedia } from './use-match-media';

type QuickChatParticipantsButtonProps = {
  requestNo: string;
  /** 나가기 뒤 이동: messenger → `?request` 제거(목록) · detail → `/dashboard/quick` */
  variant: QuickRequestConversationVariant;
  className?: string;
};

/**
 * plan 101 U-1 · U-2 · designer §1 — 헤더 「참여자 N」. messages 캐시(`quickRequestKeys.messages(no)`)를 구독해
 * 참여자·viewer를 읽는다(추가 요청 없음 · `staleTime: Infinity` — 갱신은 대화 본체 observer·invalidate가 한다) ·
 * lg↑ `Popover` / 미만 `Drawer`(`useMatchMedia`). 제외·나가기 `AlertModal`은 패널을 닫은 뒤 띄운다(Popover 밖 Dialog).
 * plan 106 — 휴대폰 대화 상단바는 이 버튼 대신 「⋯」 → 「참여자 N」으로 `QuickChatParticipantsDrawer`를 연다
 * (Drawer는 `quick-chat-participants-drawer.tsx`로 분리 · 이 버튼의 lg 미만 경로도 같은 Drawer를 쓴다).
 */
export function QuickChatParticipantsButton({ requestNo, variant, className }: QuickChatParticipantsButtonProps) {
  const { data } = useQuery({ ...quickRequestMessagesQueryOptions(requestNo), staleTime: Infinity });
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);
  const [open, setOpen] = useState(false);
  const closePanel = useCallback(() => setOpen(false), []);
  const { confirmTarget, requestRemove, requestLeave, closeConfirm } = useQuickChatParticipantConfirm(closePanel);
  const handleLeft = useQuickChatLeaveNavigation(variant);

  if (!data) {
    return null;
  }

  const { participants, viewer } = data;
  const count = participants.length;

  const trigger = (
    <Button
      type='button'
      variant='outline'
      size='sm'
      className={cn('shrink-0 tabular-nums', isMobile ? 'h-11 px-3' : 'h-9', className)}
      aria-label={quickChatText.participantsAria(count)}
      aria-expanded={open}
      data-testid='quick-chat-participants-button'
      data-count={count}
      onClick={isMobile ? () => setOpen(true) : undefined}
    >
      <Icons.teams aria-hidden />
      {quickChatText.participantsLabel(count)}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <QuickChatParticipantsDrawer requestNo={requestNo} variant={variant} open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align='end'
          // 참여자가 많아 위로 뒤집혀도 머리(「참여자 추가」)가 화면 밖으로 잘리지 않게 가용 높이로 제한 · 목록만 스크롤
          className='flex max-h-[var(--radix-popover-content-available-height)] w-80 flex-col p-0'
          data-testid='quick-chat-participants-popover'
        >
          <QuickChatParticipantsPanel
            requestNo={requestNo}
            layout='popover'
            participants={participants}
            viewer={viewer}
            onRequestRemove={requestRemove}
            onRequestLeave={requestLeave}
          />
        </PopoverContent>
      </Popover>
      <QuickChatParticipantConfirm
        requestNo={requestNo}
        viewer={viewer}
        target={confirmTarget}
        onClose={closeConfirm}
        onLeft={handleLeft}
      />
    </>
  );
}
