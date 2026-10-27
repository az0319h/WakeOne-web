'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { formatAbsoluteDateKo } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { quickRequestKeys, quickRequestMessagesQueryOptions } from '../../api/queries';
import type { QuickRequestChatRequestSummary } from '../../api/types';
import type { QuickChatMessagesCache } from '../../lib/quick-chat-cache';
import { QuickRequestQueryBoundary } from '../quick-request-query-boundary';
import { groupMessages } from './group-messages';
import { QuickChatComposer } from './quick-chat-composer';
import { QUICK_CHAT_TEXT } from './quick-chat-constants';
import { QuickChatMessageList } from './quick-chat-message-list';
import { QuickChatQuickReplies } from './quick-chat-quick-replies';
import { QuickChatReadOnlyNotice } from './quick-chat-read-only-notice';
import { useQuickChatRealtime } from './quick-chat-realtime';
import { QuickChatTypingIndicator } from './quick-chat-typing-indicator';
import { useMarkRead } from './use-mark-read';
import { useSendMessage } from './use-send-message';
import { useTypingBroadcast, useTypingReceiver } from './use-typing-broadcast';

export type QuickRequestConversationVariant = 'messenger' | 'detail';

type QuickRequestConversationProps = {
  requestNo: string;
  variant: QuickRequestConversationVariant;
  /** 데이터가 있어야 그릴 수 있는 헤더 (Messenger: 요청번호·상태·경로·상세 보기 / 상세: 없음) */
  header?: (request: QuickRequestChatRequestSummary) => ReactNode;
  /** 404(권한 없음 포함) */
  notFound: ReactNode;
  /** 열릴 때 입력창 포커스 (상세 `?chat=1`) */
  autoFocus?: boolean;
  className?: string;
};

type ConversationBodyProps = {
  requestNo: string;
  data: QuickChatMessagesCache;
  header?: (request: QuickRequestChatRequestSummary) => ReactNode;
  autoFocus?: boolean;
};

function ConversationBody({ requestNo, data, header, autoFocus }: ConversationBodyProps) {
  const { viewer, request, canWrite, readOnlyReason, quickReplies, reads, messages } = data;
  // 대화를 연 시점의 읽음 위치 — 갱신돼도 「여기부터 새 메시지」가 바로 사라지지 않는다 (C-13)
  const [initialLastReadId] = useState(data.myLastReadMessageId);
  const [draft, setDraft] = useState('');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { names: typingNames, onTyping } = useTypingReceiver();
  const { sendTyping } = useQuickChatRealtime({
    requestNo,
    requestId: request.id,
    myUserId: viewer.userId,
    onTyping
  });
  const typing = useTypingBroadcast({
    enabled: canWrite,
    userId: viewer.userId,
    name: viewer.name,
    send: sendTyping
  });
  const getDraft = useCallback(() => draftRef.current, []);
  const { send, retry, discard, isPending } = useSendMessage({ requestNo, viewer, getDraft, setDraft });
  const markRead = useMarkRead({ requestNo, myLastReadMessageId: data.myLastReadMessageId });

  const items = useMemo(
    () =>
      groupMessages(messages, {
        myUserId: viewer.userId,
        myLastReadMessageId: initialLastReadId,
        dayKey: formatAbsoluteDateKo
      }),
    [initialLastReadId, messages, viewer.userId]
  );

  function focusComposer() {
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    const end = node.value.length;
    node.setSelectionRange(end, end);
  }

  function handleSubmit(body: string) {
    setDraft('');
    send(body);
    requestAnimationFrame(focusComposer);
  }

  function handlePickReply(text: string) {
    setDraft(text);
    requestAnimationFrame(focusComposer);
  }

  return (
    <>
      {header ? <div className='shrink-0 border-b'>{header(request)}</div> : null}
      <div className='relative min-h-0 flex-1'>
        <QuickChatMessageList
          items={items}
          messages={messages}
          viewer={viewer}
          reads={reads}
          canWrite={canWrite}
          onLastMessageVisible={markRead}
          onRetry={retry}
          onDiscard={discard}
        />
      </div>
      <QuickChatTypingIndicator names={typingNames} />
      <div
        data-testid='quick-chat-composer'
        className='shrink-0 border-t bg-card px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]'
      >
        {canWrite ? (
          <>
            <QuickChatQuickReplies replies={quickReplies} onPick={handlePickReply} />
            <QuickChatComposer
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={handleSubmit}
              isPending={isPending}
              textareaRef={textareaRef}
              onTypingInput={typing.onInput}
              onTypingStop={typing.stop}
            />
          </>
        ) : (
          <QuickChatReadOnlyNotice reason={readOnlyReason ?? 'locked'} />
        )}
      </div>
      {autoFocus && canWrite ? <AutoFocus target={textareaRef} /> : null}
    </>
  );
}

function AutoFocus({ target }: { target: React.RefObject<HTMLTextAreaElement | null> }) {
  const doneRef = useRef(false);
  if (!doneRef.current && typeof window !== 'undefined') {
    doneRef.current = true;
    requestAnimationFrame(() => target.current?.focus());
  }
  return null;
}

function ConversationContent({
  requestNo,
  header,
  notFound,
  autoFocus
}: Omit<QuickRequestConversationProps, 'variant' | 'className'>) {
  const { data } = useSuspenseQuery(quickRequestMessagesQueryOptions(requestNo));
  if (!data) {
    return <>{notFound}</>;
  }
  // 캐시에는 optimistic 임시 행(id: 'temp-…')이 섞인다 — `lib/quick-chat-cache.ts`
  const cache = data as QuickChatMessagesCache;
  return <ConversationBody key={requestNo} requestNo={requestNo} data={cache} header={header} autoFocus={autoFocus} />;
}

/**
 * plan 93 C-1 — 공용 대화 본체 (Messenger `variant='messenger'` · 상세 `variant='detail'` 공유).
 * Suspense·오류 경계 내장(`QuickRequestQueryBoundary` · compact 스피너) · hydration 전에는 로딩만.
 */
export function QuickRequestConversation({
  requestNo,
  variant,
  header,
  notFound,
  autoFocus,
  className
}: QuickRequestConversationProps) {
  return (
    <div
      data-variant={variant}
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <QuickRequestQueryBoundary
        errorMessage={QUICK_CHAT_TEXT.loadFailed}
        ssrQueryKey={quickRequestKeys.messages(requestNo)}
        loadingFallback={<PageLoadingSpinner variant='compact' className='flex-1' />}
        renderError={(alert) => <div className='p-4'>{alert}</div>}
      >
        <ConversationContent requestNo={requestNo} header={header} notFound={notFound} autoFocus={autoFocus} />
      </QuickRequestQueryBoundary>
    </div>
  );
}
