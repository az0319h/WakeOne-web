'use client';

import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
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

/** 목록 항목 button — 아바타·요청번호·요청자·상태·경로·미리보기·시각·안 읽은 수 (U-2 · AC-02) */
export function QuickChatConversationItem({ conversation, selected, onSelect }: QuickChatConversationItemProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const { requestNo, requesterName, status, route, lastMessage, unreadCount, requestedAt } = conversation;

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
          'flex min-h-[4.5rem] w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors',
          'focus-visible:ring-[3px] focus-visible:ring-ring/50',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'
        )}
        onClick={() => onSelect(requestNo)}
      >
        <Avatar className='size-9'>
          <AvatarFallback className='bg-primary/10 text-sm font-medium text-primary'>
            {quickChatInitial(requesterName)}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1 space-y-0.5'>
          <div className='flex items-center justify-between gap-2'>
            <span translate='no' className='truncate font-medium tabular-nums'>
              {requestNo} · {requesterName}
            </span>
            <time
              dateTime={lastMessage?.createdAt ?? requestedAt}
              className='shrink-0 text-[11px] text-muted-foreground tabular-nums'
            >
              {formatAbsoluteDateTimeKo(lastMessage?.createdAt ?? requestedAt)}
            </time>
          </div>
          <div className='flex items-center gap-1.5'>
            <QuickRequestStatusBadge status={status} />
            <span className='truncate text-xs text-muted-foreground'>
              {route.from} → {route.to}
            </span>
          </div>
          <div className='flex items-center justify-between gap-2'>
            <p className='truncate text-xs text-muted-foreground'>
              {lastMessage ? `${lastMessage.authorName}: ${lastMessage.body}` : QUICK_CHAT_TEXT.noLastMessage}
            </p>
            {unreadCount > 0 ? (
              <Badge
                aria-label={quickChatText.unreadBadge(unreadCount)}
                data-testid={`quick-chat-list-unread-${requestNo}`}
                className='h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums'
              >
                {formatUnreadBadge(unreadCount)}
              </Badge>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}
