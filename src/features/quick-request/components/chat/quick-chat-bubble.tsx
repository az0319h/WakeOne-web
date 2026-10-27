'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { QUICK_CHAT_ROLE_LABELS } from '../../schemas/quick-request-chat';
import { isTempMessageId, type QuickChatMessageItem } from '../../lib/quick-chat-cache';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';
import { QuickChatReceipt, type QuickChatReader, type QuickChatReceiptState } from './quick-chat-receipt';

export function quickChatInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : '?';
}

type QuickChatBubbleProps = {
  message: QuickChatMessageItem;
  isMine: boolean;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  receiptState: QuickChatReceiptState;
  readers: QuickChatReader[];
  onRetry: (tempId: string, body: string) => void;
  onDiscard: (tempId: string) => void;
};

/** 말풍선 — 상대 왼쪽(muted) · 나 오른쪽(primary) · 연속 묶음 · pending/failed 상태 (U-4 · U-13 · designer §4.2 표) */
export function QuickChatBubble({
  message,
  isMine,
  isGroupStart,
  isGroupEnd,
  receiptState,
  readers,
  onRetry,
  onDiscard
}: QuickChatBubbleProps) {
  const clientState = message.clientState;
  const dataState = clientState === 'failed' ? 'failed' : clientState === 'pending' ? 'pending' : 'sent';
  const tempId = isTempMessageId(message.id) ? message.id : null;
  const time = (
    <time
      dateTime={message.createdAt}
      className='text-[11px] whitespace-nowrap text-muted-foreground tabular-nums'
    >
      {formatAbsoluteDateTimeKo(message.createdAt)}
    </time>
  );

  return (
    <div
      data-testid={`quick-chat-message-${String(message.id)}`}
      data-message-id={tempId ? undefined : String(message.id)}
      data-mine={isMine ? 'true' : 'false'}
      data-author-role={message.authorRole}
      data-state={dataState}
      className={cn('flex min-w-0 items-end gap-2', isGroupStart ? 'mt-3' : 'mt-1', isMine && 'flex-row-reverse pl-10')}
    >
      {!isMine ? (
        isGroupStart ? (
          <Avatar className='size-7'>
            <AvatarFallback className='bg-primary/10 text-xs font-medium text-primary'>
              {quickChatInitial(message.authorName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span aria-hidden className='w-7 shrink-0' />
        )
      ) : null}
      <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[70%]', isMine && 'items-end')}>
        {isGroupStart ? (
          <div className={cn('flex max-w-full min-w-0 items-center gap-1.5 text-xs', isMine && 'justify-end')}>
            <span className='min-w-0 truncate font-medium text-foreground'>{message.authorName}</span>
            <Badge variant='outline' className='rounded-full px-1.5 py-0 text-[11px] font-normal'>
              {QUICK_CHAT_ROLE_LABELS[message.authorRole]}
            </Badge>
          </div>
        ) : null}
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
            isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            clientState === 'pending' && 'opacity-60',
            clientState === 'failed' && 'border border-destructive bg-destructive/10 text-foreground'
          )}
        >
          {message.body}
        </div>
        {clientState === 'failed' && tempId ? (
          <div className='flex items-center gap-2 text-xs text-destructive'>
            <span>{QUICK_CHAT_TEXT.sendFailed}</span>
            <Button
              type='button'
              variant='link'
              size='sm'
              className='h-auto p-0 text-xs text-destructive'
              data-testid={`quick-chat-retry-${tempId}`}
              onClick={() => onRetry(tempId, message.body)}
            >
              <Icons.refresh aria-hidden className='size-3' />
              {QUICK_CHAT_TEXT.retry}
            </Button>
            <Button
              type='button'
              variant='link'
              size='sm'
              className='h-auto p-0 text-xs text-muted-foreground'
              data-testid={`quick-chat-discard-${tempId}`}
              onClick={() => onDiscard(tempId)}
            >
              <Icons.trash aria-hidden className='size-3' />
              {QUICK_CHAT_TEXT.discard}
            </Button>
          </div>
        ) : isMine ? (
          <div className='flex items-center gap-1.5'>
            <QuickChatReceipt messageId={message.id} state={receiptState} readers={readers} />
            {isGroupEnd ? (
              <>
                <span aria-hidden className='text-[11px] text-muted-foreground'>
                  ·
                </span>
                {time}
              </>
            ) : null}
          </div>
        ) : isGroupEnd ? (
          time
        ) : null}
      </div>
    </div>
  );
}
