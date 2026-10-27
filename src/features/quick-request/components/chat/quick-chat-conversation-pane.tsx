'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';
import { QuickChatHeader } from './quick-chat-header';
import { QuickRequestConversation } from './quick-request-conversation';

type QuickChatConversationPaneProps = {
  requestNo: string | null;
  onBack: () => void;
  className?: string;
};

/** 오른쪽 대화 pane — 선택 없음 / 404 / 대화 (U-10 · AC-06) */
export function QuickChatConversationPane({ requestNo, onBack, className }: QuickChatConversationPaneProps) {
  return (
    <section
      aria-label={QUICK_CHAT_TEXT.messagesAriaLabel}
      data-testid='quick-chat-conversation'
      className={cn('min-h-0 min-w-0 flex-col rounded-xl border bg-card', className)}
    >
      {requestNo ? (
        <QuickRequestConversation
          key={requestNo}
          requestNo={requestNo}
          variant='messenger'
          header={(request) => <QuickChatHeader request={request} onBack={onBack} />}
          notFound={
            <div
              data-testid='quick-chat-not-found'
              className='flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'
            >
              <Icons.alertCircle aria-hidden className='size-8 text-muted-foreground' />
              <p className='text-sm text-muted-foreground'>{QUICK_CHAT_TEXT.notFound}</p>
              <Button type='button' variant='outline' className='h-11 lg:hidden' onClick={onBack}>
                {QUICK_CHAT_TEXT.backToList}
              </Button>
            </div>
          }
        />
      ) : (
        <div
          data-testid='quick-chat-no-selection'
          className='flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'
        >
          <Icons.chat aria-hidden className='size-8 text-muted-foreground' />
          <p className='text-sm text-muted-foreground'>{QUICK_CHAT_TEXT.noSelection}</p>
        </div>
      )}
    </section>
  );
}
