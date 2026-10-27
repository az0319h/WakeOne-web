'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';

export type QuickChatReceiptState = 'pending' | 'sent' | 'read';

export type QuickChatReader = {
  userId: string;
  name: string;
  lastReadAt: string;
};

type QuickChatReceiptProps = {
  messageId: number | string;
  state: QuickChatReceiptState;
  /** C-12 상대편 중 읽은 사람 전원 (tooltip에 한 줄씩) */
  readers: QuickChatReader[];
};

/** ✓ 전송 중 / ✓ 전송됨 / ✓✓ 읽음 — 내 메시지에만 (U-4 · C-12) */
export function QuickChatReceipt({ messageId, state, readers }: QuickChatReceiptProps) {
  const label =
    state === 'pending'
      ? QUICK_CHAT_TEXT.receiptPending
      : state === 'read'
        ? QUICK_CHAT_TEXT.receiptRead
        : QUICK_CHAT_TEXT.receiptSent;

  const trigger = (
    <button
      type='button'
      data-testid={`quick-chat-receipt-${String(messageId)}`}
      data-state={state}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] whitespace-nowrap',
        state === 'read' ? 'text-primary' : 'text-muted-foreground'
      )}
    >
      {state === 'read' ? (
        <Icons.checks aria-hidden className='size-3' />
      ) : (
        <Icons.check aria-hidden className={cn('size-3', state === 'pending' && 'opacity-50')} />
      )}
      {label}
    </button>
  );

  if (state === 'pending') {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side='top' align='end'>
        {state === 'read' ? (
          <ul className='flex flex-col gap-0.5'>
            {readers.map((reader) => (
              <li key={reader.userId} className='tabular-nums'>
                {quickChatText.readAt(reader.name, formatAbsoluteDateTimeKo(reader.lastReadAt))}
              </li>
            ))}
          </ul>
        ) : (
          QUICK_CHAT_TEXT.receiptUnreadTooltip
        )}
      </TooltipContent>
    </Tooltip>
  );
}
