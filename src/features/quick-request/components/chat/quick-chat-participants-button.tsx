'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { quickRequestMessagesQueryOptions } from '../../api/queries';
import type { QuickRequestParticipant } from '../../api/types';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY, QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import {
  QuickChatParticipantConfirm,
  QuickChatParticipantsPanel,
  type QuickChatParticipantConfirmTarget
} from './quick-chat-participants-panel';
import type { QuickRequestConversationVariant } from './quick-request-conversation';
import { useMatchMedia } from './use-match-media';

type QuickChatParticipantsButtonProps = {
  requestNo: string;
  /** 나가기 뒤 이동: messenger → `?request` 제거(목록) · detail → `/dashboard/quick` */
  variant: QuickRequestConversationVariant;
  className?: string;
};

const leaveParamParsers = { request: parseAsString };

/**
 * plan 101 U-1 · U-2 · designer §1 — 헤더 「참여자 N」. messages 캐시(`quickRequestKeys.messages(no)`)를 구독해
 * 참여자·viewer를 읽는다(추가 요청 없음 · `staleTime: Infinity` — 갱신은 대화 본체 observer·invalidate가 한다) ·
 * lg↑ `Popover` / 미만 `Drawer`(`useMatchMedia`). 제외·나가기 `AlertModal`은 패널을 닫은 뒤 띄운다(Popover 밖 Dialog).
 */
export function QuickChatParticipantsButton({ requestNo, variant, className }: QuickChatParticipantsButtonProps) {
  const { data } = useQuery({ ...quickRequestMessagesQueryOptions(requestNo), staleTime: Infinity });
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);
  const router = useRouter();
  const [, setLeaveParams] = useQueryStates(leaveParamParsers, { shallow: true });
  const [open, setOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<QuickChatParticipantConfirmTarget>(null);

  const handleRequestRemove = useCallback((participant: QuickRequestParticipant) => {
    setOpen(false);
    setConfirmTarget({ kind: 'remove', participant });
  }, []);
  const handleRequestLeave = useCallback(() => {
    setOpen(false);
    setConfirmTarget({ kind: 'leave' });
  }, []);
  const closeConfirm = useCallback(() => setConfirmTarget(null), []);
  const handleLeft = useCallback(() => {
    if (variant === 'messenger') {
      void setLeaveParams({ request: null }, { history: 'replace' });
      return;
    }
    router.replace('/dashboard/quick');
  }, [router, setLeaveParams, variant]);

  if (!data) {
    return null;
  }

  const { participants, viewer } = data;
  const count = participants.length;
  const label = quickChatText.participantsLabel(count);

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
    >
      <Icons.teams aria-hidden />
      {label}
    </Button>
  );

  const panel = (
    <QuickChatParticipantsPanel
      requestNo={requestNo}
      layout={isMobile ? 'drawer' : 'popover'}
      participants={participants}
      viewer={viewer}
      onRequestRemove={handleRequestRemove}
      onRequestLeave={handleRequestLeave}
    />
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent
            data-testid='quick-chat-participants-drawer'
            className='data-[vaul-drawer-direction=bottom]:max-h-[85dvh]'
          >
            <DrawerHeader className='text-left'>
              <DrawerTitle>{label}</DrawerTitle>
              <DrawerDescription>{QUICK_CHAT_TEXT.participantsDescription}</DrawerDescription>
            </DrawerHeader>
            {panel}
            <DrawerFooter className='border-t pb-[max(1rem,env(safe-area-inset-bottom))]'>
              <DrawerClose asChild>
                <Button type='button' variant='outline' className='h-11 w-full'>
                  {QUICK_CHAT_TEXT.close}
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            align='end'
            // 참여자가 많아 위로 뒤집혀도 머리(「참여자 추가」)가 화면 밖으로 잘리지 않게 가용 높이로 제한 · 목록만 스크롤
            className='flex max-h-[var(--radix-popover-content-available-height)] w-80 flex-col p-0'
            data-testid='quick-chat-participants-popover'
          >
            {panel}
          </PopoverContent>
        </Popover>
      )}
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
