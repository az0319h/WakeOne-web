'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY, QUICK_CHAT_TEXT } from './quick-chat-constants';
import { QuickChatHeader } from './quick-chat-header';
import { QuickChatHeaderFrame } from './quick-chat-mobile-header';
import { QuickRequestConversation } from './quick-request-conversation';
import { useMatchMedia } from './use-match-media';

type QuickChatConversationPaneProps = {
  requestNo: string | null;
  /** lg 미만 「목록」 — Messenger가 `useQuickBack`(기록이 있으면 back · 없으면 목록으로 replace)을 넘긴다 (plan 106 D-5) */
  onBack: () => void;
  className?: string;
};

/**
 * 오른쪽 대화 pane — 선택 없음 / 404 / 대화 (U-10 · AC-06).
 * plan 106 D-12 — lg 미만은 전체 화면(모서리·테두리 없음 · 화면 끝까지) + 로딩·오류·404에도 상단바 틀(뒤로 가능).
 */
export function QuickChatConversationPane({ requestNo, onBack, className }: QuickChatConversationPaneProps) {
  // 틀은 hydration 뒤 lg 미만에서만 넘긴다 — PC에서 숨은 「목록」 testid가 DOM에 겹쳐 남지 않게 (designer K2)
  const isMobile = useMatchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY);

  return (
    <section
      aria-label={QUICK_CHAT_TEXT.messagesAriaLabel}
      data-testid='quick-chat-conversation'
      className={cn(
        'min-h-0 min-w-0 flex-col rounded-xl border bg-card max-lg:rounded-none max-lg:border-0',
        className
      )}
    >
      {requestNo ? (
        <QuickRequestConversation
          key={requestNo}
          requestNo={requestNo}
          variant='messenger'
          header={(request) => <QuickChatHeader request={request} onBack={onBack} />}
          frameHeader={
            isMobile ? <QuickChatHeaderFrame variant='messenger' requestNo={requestNo} onBack={onBack} /> : undefined
          }
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
