'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { QuickRequestDetail } from '../../api/types';
import { QUICK_CHAT_TEXT } from '../chat/quick-chat-constants';
import { QuickChatParticipantsButton } from '../chat/quick-chat-participants-button';
import { QuickRequestConversation } from '../chat/quick-request-conversation';
import { useVisualViewportHeight } from '../chat/use-visual-viewport-height';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { QuickRequestNotFound } from './quick-request-not-found';

type QuickRequestDetailChatViewProps = {
  detail: QuickRequestDetail;
  onBack: () => void;
};

/**
 * plan 93 designer §4.3 — xl 미만 `?chat=1` 전체 높이 대화 뷰 (Drawer·Sheet 아님 · 문서 흐름 안 → 키보드가 입력창을 가리지 않음).
 * 헤더 「상세로」 + 요청번호 + 상태, 본문은 공용 `QuickRequestConversation variant='detail'`.
 */
export function QuickRequestDetailChatView({ detail, onBack }: QuickRequestDetailChatViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  // 상세를 아래로 내려 보다가 열면 창 스크롤이 남아 있다 → 맨 위로 (훅이 `top` 기준으로 높이를 잡는다)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  useVisualViewportHeight(ref);

  return (
    <div
      ref={ref}
      data-testid='quick-detail-chat'
      data-mode='full'
      className='flex h-[calc(100dvh-11rem)] min-h-[20rem] min-w-0 flex-col rounded-xl border bg-card'
    >
      <div className='flex shrink-0 items-center gap-2 border-b px-4 py-3'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='-ml-2 size-11 shrink-0'
          aria-label={QUICK_CHAT_TEXT.backToDetail}
          data-testid='quick-detail-chat-back'
          onClick={onBack}
        >
          <Icons.chevronLeft aria-hidden />
        </Button>
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
          <h3 className='text-base font-semibold'>{QUICK_CHAT_TEXT.detailChatTitle}</h3>
          <span translate='no' className='text-sm text-muted-foreground tabular-nums'>
            {detail.requestNo}
          </span>
          <QuickRequestStatusBadge status={detail.status} />
        </div>
        {/* plan 101 U-1 — 「참여자 N」 */}
        <QuickChatParticipantsButton requestNo={detail.requestNo} variant='detail' className='ml-auto' />
      </div>
      <QuickRequestConversation
        requestNo={detail.requestNo}
        variant='detail'
        autoFocus
        notFound={<QuickRequestNotFound />}
      />
    </div>
  );
}
