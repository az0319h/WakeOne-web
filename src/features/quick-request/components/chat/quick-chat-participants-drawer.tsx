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
  DrawerTitle
} from '@/components/ui/drawer';
import { quickRequestMessagesQueryOptions } from '../../api/queries';
import type { QuickRequestParticipant } from '../../api/types';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import {
  QuickChatParticipantConfirm,
  QuickChatParticipantsPanel,
  type QuickChatParticipantConfirmTarget
} from './quick-chat-participants-panel';
import type { QuickRequestConversationVariant } from './quick-request-conversation';

const leaveParamParsers = { request: parseAsString };

/**
 * plan 101 — 본인 「나가기」가 끝난 뒤 이동: messenger → `?request` 제거(목록 · replace라 기록이 쌓이지 않음) ·
 * detail → `/dashboard/quick`. 참여자 Popover 버튼·Drawer가 같은 규칙을 쓴다.
 */
export function useQuickChatLeaveNavigation(variant: QuickRequestConversationVariant): () => void {
  const router = useRouter();
  const [, setLeaveParams] = useQueryStates(leaveParamParsers, { shallow: true });

  return useCallback(() => {
    if (variant === 'messenger') {
      void setLeaveParams({ request: null }, { history: 'replace' });
      return;
    }
    router.replace('/dashboard/quick');
  }, [router, setLeaveParams, variant]);
}

/**
 * 참여자 패널을 닫고 확인창(`AlertModal`)을 띄우는 상태 — Popover·Drawer 공용.
 * 제외·나가기 확인은 패널 밖 Dialog라 패널을 먼저 닫는다 (Popover 밖 포커스로 패널이 닫히는 문제 회피).
 */
export function useQuickChatParticipantConfirm(onPanelClose: () => void) {
  const [confirmTarget, setConfirmTarget] = useState<QuickChatParticipantConfirmTarget>(null);

  const requestRemove = useCallback(
    (participant: QuickRequestParticipant) => {
      onPanelClose();
      setConfirmTarget({ kind: 'remove', participant });
    },
    [onPanelClose]
  );
  const requestLeave = useCallback(() => {
    onPanelClose();
    setConfirmTarget({ kind: 'leave' });
  }, [onPanelClose]);
  const closeConfirm = useCallback(() => setConfirmTarget(null), []);

  return { confirmTarget, requestRemove, requestLeave, closeConfirm };
}

type QuickChatParticipantsDrawerProps = {
  requestNo: string;
  /** 나가기 뒤 이동 규칙 (`useQuickChatLeaveNavigation`) */
  variant: QuickRequestConversationVariant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * plan 106 designer §5.5 — 참여자 Drawer(아래에서 · controlled). 트리거가 없다:
 * 휴대폰 대화 상단바 「⋯」 → 「참여자 N」, 또는 `QuickChatParticipantsButton`(lg 미만)이 연다.
 * messages 캐시(`quickRequestKeys.messages(no)`)를 구독해 참여자·viewer를 읽는다(추가 요청 없음 · `staleTime: Infinity`).
 * 제외·나가기 `AlertModal`도 여기서 띄운다 (plan 101 흐름 그대로).
 */
export function QuickChatParticipantsDrawer({ requestNo, variant, open, onOpenChange }: QuickChatParticipantsDrawerProps) {
  const { data } = useQuery({ ...quickRequestMessagesQueryOptions(requestNo), staleTime: Infinity });
  const closePanel = useCallback(() => onOpenChange(false), [onOpenChange]);
  const { confirmTarget, requestRemove, requestLeave, closeConfirm } = useQuickChatParticipantConfirm(closePanel);
  const handleLeft = useQuickChatLeaveNavigation(variant);

  if (!data) {
    return null;
  }

  const { participants, viewer } = data;
  const label = quickChatText.participantsLabel(participants.length);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          data-testid='quick-chat-participants-drawer'
          className='data-[vaul-drawer-direction=bottom]:max-h-[85dvh]'
        >
          <DrawerHeader className='text-left'>
            <DrawerTitle>{label}</DrawerTitle>
            <DrawerDescription>{QUICK_CHAT_TEXT.participantsDescription}</DrawerDescription>
          </DrawerHeader>
          <QuickChatParticipantsPanel
            requestNo={requestNo}
            layout='drawer'
            participants={participants}
            viewer={viewer}
            onRequestRemove={requestRemove}
            onRequestLeave={requestLeave}
          />
          <DrawerFooter className='border-t pb-[max(1rem,env(safe-area-inset-bottom))]'>
            <DrawerClose asChild>
              <Button type='button' variant='outline' className='h-11 w-full'>
                {QUICK_CHAT_TEXT.close}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
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
