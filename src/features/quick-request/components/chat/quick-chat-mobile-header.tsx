'use client';

import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { quickRequestMessagesQueryOptions } from '../../api/queries';
import type { QuickRequestChatRequestSummary } from '../../api/types';
import { quickRequestDetailHref } from '../dashboard/quick-dashboard-columns';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import { QuickChatParticipantsDrawer } from './quick-chat-participants-drawer';
import type { QuickRequestConversationVariant } from './quick-request-conversation';

/** 「⋯」 메뉴 항목 — ui 기본 `py-1.5`(약 32px)를 className으로만 44px로 (designer §9 · ui 수정 금지) */
const MENU_ITEM_CLASS_NAME = 'min-h-11 gap-2 text-sm';

const BACK_BUTTON_PROPS: Record<QuickRequestConversationVariant, { label: string; testId: string }> = {
  messenger: { label: QUICK_CHAT_TEXT.backToList, testId: 'quick-chat-back' },
  detail: { label: QUICK_CHAT_TEXT.backToDetail, testId: 'quick-detail-chat-back' }
};

type QuickChatHeaderFrameProps = {
  /** 대화방(`messenger` · 뒤로 「목록」 `quick-chat-back`) · 상세 대화(`detail` · 「상세로」 `quick-detail-chat-back`) */
  variant: QuickRequestConversationVariant;
  requestNo: string;
  onBack: () => void;
  /** 번호 옆 상태 배지 — 로딩·오류 틀에는 없음 */
  badge?: ReactNode;
  /** 둘째 줄(경로 등 · 한 줄 말줄임) */
  subtitle?: string;
  /** 「⋯」 자리 — 없으면 누를 수 없는 「⋯」(로딩·오류 중) */
  menu?: ReactNode;
};

type QuickChatMoreTriggerProps = Omit<ComponentProps<typeof Button>, 'children'>;

/** 「⋯」 버튼 — `DropdownMenuTrigger asChild`가 넘기는 ref·이벤트·aria를 Button에 그대로 전달한다 (React 19 ref prop) */
function QuickChatMoreTrigger({ className, ...props }: QuickChatMoreTriggerProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      aria-label={QUICK_CHAT_TEXT.more}
      data-testid='quick-chat-more'
      {...props}
      className={cn('size-11 shrink-0 touch-manipulation', className)}
    >
      <Icons.dots aria-hidden className='size-5' />
    </Button>
  );
}

/**
 * plan 106 D-12 · designer §5.5 — 전체 화면 대화 한 줄 상단바 틀 (lg 미만 · 높이 56 · `quick-chat-header`).
 * [뒤로 44] [번호(한 줄) + 상태 배지 / 둘째 줄 말줄임] [⋯ 44]. 공통 상단바가 숨으므로 로딩·오류·404 화면에도
 * 이 틀(`QuickRequestConversation` `frameHeader`)이 그려져 설치 앱에서도 항상 빠져나갈 수 있다(M-6).
 */
export function QuickChatHeaderFrame({ variant, requestNo, onBack, badge, subtitle, menu }: QuickChatHeaderFrameProps) {
  const back = BACK_BUTTON_PROPS[variant];

  return (
    <div data-testid='quick-chat-header' className='flex h-14 min-w-0 items-center gap-1 px-1'>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-11 shrink-0 touch-manipulation'
        aria-label={back.label}
        data-testid={back.testId}
        onClick={onBack}
      >
        <Icons.chevronLeft aria-hidden className='size-5' />
      </Button>
      <div className='min-w-0 flex-1 overflow-hidden'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <h2 translate='no' className='text-base font-semibold whitespace-nowrap tabular-nums'>
            {requestNo}
          </h2>
          {badge}
        </div>
        {subtitle ? <p className='truncate text-xs text-muted-foreground'>{subtitle}</p> : null}
      </div>
      {menu ?? <QuickChatMoreTrigger disabled />}
    </div>
  );
}

type QuickChatMoreMenuProps = {
  request: QuickRequestChatRequestSummary;
  variant: QuickRequestConversationVariant;
};

/**
 * 「⋯」 DropdownMenu (designer K5 · §5.5): 「참여자 N」 → 메뉴가 완전히 닫힌 뒤(`onCloseAutoFocus`) 참여자 Drawer ·
 * 「상세 보기」(`quick-chat-detail-link` · 대화방만). 항목 `role=menuitem` · 44px.
 */
function QuickChatMoreMenu({ request, variant }: QuickChatMoreMenuProps) {
  const { data } = useQuery({ ...quickRequestMessagesQueryOptions(request.requestNo), staleTime: Infinity });
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const openParticipantsAfterCloseRef = useRef(false);
  const participantCount = data?.participants.length ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <QuickChatMoreTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='min-w-48'
          data-testid='quick-chat-more-menu'
          onCloseAutoFocus={(event) => {
            // 참여자 Drawer로 넘어갈 때는 포커스를 「⋯」로 돌려보내지 않는다(돌아오면 Drawer가 바로 닫힘)
            if (!openParticipantsAfterCloseRef.current) return;
            event.preventDefault();
            openParticipantsAfterCloseRef.current = false;
            setParticipantsOpen(true);
          }}
        >
          {participantCount !== null ? (
            <DropdownMenuItem
              className={MENU_ITEM_CLASS_NAME}
              data-testid='quick-chat-more-participants'
              onSelect={() => {
                openParticipantsAfterCloseRef.current = true;
              }}
            >
              <Icons.teams aria-hidden />
              <span className='tabular-nums'>{quickChatText.participantsLabel(participantCount)}</span>
            </DropdownMenuItem>
          ) : null}
          {variant === 'messenger' ? (
            <DropdownMenuItem asChild className={cn(MENU_ITEM_CLASS_NAME, 'justify-between')}>
              <Link
                href={quickRequestDetailHref(request.requestNo)}
                aria-label={quickChatText.detailLinkLabel(request.requestNo)}
                data-testid='quick-chat-detail-link'
              >
                {QUICK_CHAT_TEXT.detailLink}
                <Icons.chevronRight aria-hidden />
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <QuickChatParticipantsDrawer
        requestNo={request.requestNo}
        variant={variant}
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
      />
    </>
  );
}

type QuickChatMobileHeaderProps = {
  request: QuickRequestChatRequestSummary;
  variant: QuickRequestConversationVariant;
  onBack: () => void;
};

/**
 * plan 106 D-12 · U-7 · designer §5.5 · §6.9 — lg 미만 전체 화면 대화(대화방 `?request=` · 상세 대화 `?chat=1`) 상단바.
 * 대화방: 둘째 줄 「{출발} → {도착} · {요청자}」 · 「⋯」 = 참여자 N + 상세 보기.
 * 상세 대화: 둘째 줄 「요청 대화 · {출발} → {도착}」 · 「⋯」 = 참여자 N만.
 * lg 이상은 기존 `QuickChatHeader`(PC) / 상세 대화 PC 헤더를 쓴다 — 호출자가 `useMatchMedia`로 하나만 그린다(testid 한 벌 · K2).
 */
export function QuickChatMobileHeader({ request, variant, onBack }: QuickChatMobileHeaderProps) {
  const subtitle =
    variant === 'messenger'
      ? quickChatText.messengerSubtitle(request.route.from, request.route.to, request.requesterName)
      : quickChatText.detailChatSubtitle(request.route.from, request.route.to);

  return (
    <QuickChatHeaderFrame
      variant={variant}
      requestNo={request.requestNo}
      onBack={onBack}
      badge={<QuickRequestStatusBadge status={request.status} />}
      subtitle={subtitle}
      menu={<QuickChatMoreMenu request={request} variant={variant} />}
    />
  );
}
