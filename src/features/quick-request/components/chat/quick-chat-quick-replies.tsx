'use client';

import { Button } from '@/components/ui/button';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';

type QuickChatQuickRepliesProps = {
  replies: readonly string[];
  /** 입력창에 채우기만 (전송 0건 · C-14) */
  onPick: (text: string) => void;
};

export function QuickChatQuickReplies({ replies, onPick }: QuickChatQuickRepliesProps) {
  if (replies.length === 0) {
    return null;
  }

  return (
    <div
      role='group'
      aria-label={QUICK_CHAT_TEXT.quickReplies}
      data-testid='quick-chat-quick-replies'
      className='flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible'
    >
      {replies.map((reply, index) => (
        <Button
          key={reply}
          type='button'
          variant='outline'
          size='sm'
          className='h-11 shrink-0 rounded-full px-3 sm:h-9'
          data-testid={`quick-chat-quick-reply-${index}`}
          onClick={() => onPick(reply)}
        >
          {reply}
        </Button>
      ))}
    </div>
  );
}
