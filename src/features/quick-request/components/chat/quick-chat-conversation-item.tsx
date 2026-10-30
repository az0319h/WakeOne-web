'use client';

import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatAbsoluteDateTimeKo, formatChatListTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { QuickRequestConversation } from '../../api/types';
import { QuickRequestStatusBadge } from '../quick-request-status-badge';
import { formatUnreadBadge } from './format-unread-badge';
import { quickChatInitial } from './quick-chat-bubble';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';

type QuickChatConversationItemProps = {
  conversation: QuickRequestConversation;
  selected: boolean;
  onSelect: (requestNo: string) => void;
};

/**
 * 목록 항목 button — 아바타 + 3행 grid (plan 97 D-6 · designer K2):
 * 1행 제목(truncate) | 안 읽은 배지 · 2행 상태 | 경로(truncate) · 3행 미리보기(truncate) | 시각(nowrap · 전체 표시).
 * plan 106 D-14 — 시각은 `formatChatListTimeKo`(KST 오늘 `HH:mm` / 같은 해 `MM-dd` / 이전 해 `yyyy-MM-dd` · 퀵 대화 예외)
 * · 잘리는 건 미리보기뿐 · 전체 시각은 `dateTime`(ISO)과 hover `title`.
 */
export function QuickChatConversationItem({ conversation, selected, onSelect }: QuickChatConversationItemProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { requestNo, requesterName, status, route, lastMessage, unreadCount, requestedAt } = conversation;
  const timeSource = lastMessage?.createdAt ?? requestedAt;

  // 알림 착지(`?request=`) 시 선택 항목이 보이게 (designer §4.5 ④)
  useEffect(() => {
    if (selected) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [selected]);

  return (
    <li>
      <button
        ref={ref}
        type='button'
        aria-current={selected ? 'true' : undefined}
        data-testid={`quick-chat-list-item-${requestNo}`}
        data-unread={unreadCount}
        className={cn(
          'grid min-h-[4.5rem] w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 px-4 py-3 text-left outline-none transition-colors',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
        )}
        onClick={() => onSelect(requestNo)}
      >
        <Avatar className='size-9 self-start'>
          <AvatarFallback className='bg-primary/10 text-sm font-medium text-primary'>
            {quickChatInitial(requesterName)}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 space-y-0.5'>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2'>
            <span translate='no' className='min-w-0 truncate font-medium tabular-nums'>
              {requestNo} · {requesterName}
            </span>
            {unreadCount > 0 ? (
              <Badge
                aria-label={quickChatText.unreadBadge(unreadCount)}
                data-testid={`quick-chat-list-unread-${requestNo}`}
                className='h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums'
              >
                {formatUnreadBadge(unreadCount)}
              </Badge>
            ) : (
              <span aria-hidden className='w-0' />
            )}
          </div>
          <div className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5'>
            <QuickRequestStatusBadge status={status} />
            <span className='min-w-0 truncate text-xs text-muted-foreground'>
              {route.from} → {route.to}
            </span>
          </div>
          <div className='grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2'>
            <p className='min-w-0 truncate text-xs text-muted-foreground'>
              {lastMessage ? `${lastMessage.authorName}: ${lastMessage.body}` : QUICK_CHAT_TEXT.noLastMessage}
            </p>
            <time
              dateTime={timeSource}
              title={formatAbsoluteDateTimeKo(timeSource)}
              className='shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums'
            >
              {formatChatListTimeKo(timeSource)}
            </time>
          </div>
        </div>
      </button>
    </li>
  );
}
