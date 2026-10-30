'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icons } from '@/components/icons';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY, QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import { useMatchMedia } from './use-match-media';

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

/**
 * ✓ 전송 중 / ✓ 전송됨 / ✓✓ 읽음 — 내 메시지에만 (U-4 · C-12).
 * plan 106 M-1 — lg 미만(터치)에서는 Tooltip이 열리지 않으므로 누를 수 없는 글자(`span`)로 둔다(44px 미만 버튼 0 · AC-09).
 * PC는 지금처럼 button + 읽은 사람·시각 Tooltip.
 */
export function QuickChatReceipt({ messageId, state, readers }: QuickChatReceiptProps) {
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);
  const label =
    state === 'pending'
      ? QUICK_CHAT_TEXT.receiptPending
      : state === 'read'
        ? QUICK_CHAT_TEXT.receiptRead
        : QUICK_CHAT_TEXT.receiptSent;
  const className = cn(
    'inline-flex items-center gap-1 text-[11px] whitespace-nowrap',
    state === 'read' ? 'text-primary' : 'text-muted-foreground'
  );
  const content = (
    <>
      {state === 'read' ? (
        <Icons.checks aria-hidden className='size-3' />
      ) : (
        <Icons.check aria-hidden className={cn('size-3', state === 'pending' && 'opacity-50')} />
      )}
      {label}
    </>
  );

  if (isMobile) {
    return (
      <span data-testid={`quick-chat-receipt-${String(messageId)}`} data-state={state} className={className}>
        {content}
      </span>
    );
  }

  const trigger = (
    <button
      type='button'
      data-testid={`quick-chat-receipt-${String(messageId)}`}
      data-state={state}
      aria-label={label}
      className={className}
    >
      {content}
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
