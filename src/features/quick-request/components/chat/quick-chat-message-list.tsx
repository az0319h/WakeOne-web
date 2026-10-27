'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { QuickRequestChatViewer, QuickRequestMessageRead } from '../../api/types';
import { isTempMessageId, type QuickChatMessageItem } from '../../lib/quick-chat-cache';
import type { QuickChatListItem } from './group-messages';
import { QuickChatBubble } from './quick-chat-bubble';
import { QUICK_CHAT_NEAR_BOTTOM_PX, QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import { QuickChatDivider } from './quick-chat-divider';
import type { QuickChatReader, QuickChatReceiptState } from './quick-chat-receipt';

type QuickChatMessageListProps = {
  items: QuickChatListItem<QuickChatMessageItem>[];
  messages: QuickChatMessageItem[];
  viewer: QuickRequestChatViewer;
  reads: QuickRequestMessageRead[];
  canWrite: boolean;
  /** 마지막 서버 메시지가 보이면(IO + visibilityState) 호출 — `useMarkRead` (C-11) */
  onLastMessageVisible: (lastMessageId: number) => void;
  onRetry: (tempId: string, body: string) => void;
  onDiscard: (tempId: string) => void;
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** C-12 — 내 메시지의 상대편 역할: 내가 요청자면 동방·admin, 내가 동방·admin이면 요청자만 */
function counterpartRoles(viewerRole: QuickRequestChatViewer['role']): ReadonlySet<string> {
  return viewerRole === 'requester' || viewerRole === 'logistics'
    ? new Set(['dongbang', 'admin'])
    : new Set(['requester']);
}

/**
 * 메시지 스크롤 컨테이너 (네이티브 overflow · designer §4.2).
 * ① 열 때 unread divider 위치 또는 맨 아래 ② 내 메시지는 항상 맨 아래, 수신은 ≤120px일 때만 자동 · 아니면 「새 메시지 N ↓」
 * ③ 마지막 서버 메시지 IntersectionObserver(root=컨테이너, 0.5) + visibilityState → 읽음 갱신.
 */
export function QuickChatMessageList({
  items,
  messages,
  viewer,
  reads,
  canWrite,
  onLastMessageVisible,
  onRetry,
  onDiscard
}: QuickChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef<number | null>(null);
  const [newCount, setNewCount] = useState(0);
  const roles = counterpartRoles(viewer.role);
  const lastServerMessage = [...messages].reverse().find((message) => !isTempMessageId(message.id));
  const lastServerMessageId = typeof lastServerMessage?.id === 'number' ? lastServerMessage.id : null;

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : behavior });
    nearBottomRef.current = true;
    setNewCount(0);
  }, []);

  // ① 열 때
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const divider = container.querySelector<HTMLElement>('[data-testid="quick-chat-unread-divider"]');
    if (divider) {
      container.scrollTop = Math.max(0, divider.offsetTop - 8);
      nearBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <= QUICK_CHAT_NEAR_BOTTOM_PX;
    } else {
      container.scrollTop = container.scrollHeight;
      nearBottomRef.current = true;
    }
    prevCountRef.current = messages.length;
    // 마운트 1회 (requestNo가 바뀌면 key로 다시 마운트)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ② 새 메시지
  useLayoutEffect(() => {
    const previous = prevCountRef.current;
    prevCountRef.current = messages.length;
    if (previous === null || messages.length <= previous) return;
    const added = messages.length - previous;
    const last = messages[messages.length - 1];
    if (last && last.authorUserId === viewer.userId) {
      scrollToBottom('auto');
      return;
    }
    if (nearBottomRef.current) {
      scrollToBottom('smooth');
      return;
    }
    setNewCount((count) => count + added);
  }, [messages, scrollToBottom, viewer.userId]);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const near = distance <= QUICK_CHAT_NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    if (near) {
      setNewCount(0);
    }
  }

  // ③ 읽음 갱신
  useEffect(() => {
    const container = containerRef.current;
    if (!container || lastServerMessageId === null) return;
    const node = container.querySelector<HTMLElement>(`[data-message-id="${lastServerMessageId}"]`);
    if (!node) return;
    let visible = false;

    function check() {
      if (visible && document.visibilityState === 'visible') {
        onLastMessageVisible(lastServerMessageId as number);
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const rootHeight = entry.rootBounds?.height ?? 0;
        visible =
          entry.isIntersecting &&
          (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= rootHeight * 0.5);
        check();
      },
      { root: container, threshold: [0, 0.5, 1] }
    );
    observer.observe(node);
    document.addEventListener('visibilitychange', check);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', check);
    };
  }, [lastServerMessageId, onLastMessageVisible]);

  return (
    <>
      <div
        ref={containerRef}
        role='log'
        aria-live='polite'
        aria-relevant='additions'
        aria-label={QUICK_CHAT_TEXT.messagesAriaLabel}
        data-testid='quick-chat-messages'
        className='relative h-full overflow-y-auto overscroll-contain px-4 py-3'
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div
            data-testid='quick-chat-empty'
            className='flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground'
          >
            {canWrite ? QUICK_CHAT_TEXT.emptyWritable : QUICK_CHAT_TEXT.emptyReadOnly}
          </div>
        ) : (
          items.map((item) => {
            if (item.type === 'date') {
              return <QuickChatDivider key={item.key} label={item.label} data-testid='quick-chat-date-divider' />;
            }
            if (item.type === 'unread') {
              return (
                <QuickChatDivider
                  key={item.key}
                  label={QUICK_CHAT_TEXT.unreadDivider}
                  tone='primary'
                  data-testid='quick-chat-unread-divider'
                />
              );
            }
            const { message } = item;
            const isMine = message.authorUserId === viewer.userId;
            let receiptState: QuickChatReceiptState = 'sent';
            let readers: QuickChatReader[] = [];
            if (isMine) {
              if (message.clientState === 'pending' || isTempMessageId(message.id)) {
                receiptState = 'pending';
              } else {
                readers = reads
                  .filter(
                    (read) =>
                      read.userId !== viewer.userId &&
                      roles.has(read.role) &&
                      read.lastReadMessageId >= (message.id as number)
                  )
                  .map((read) => ({ userId: read.userId, name: read.name, lastReadAt: read.lastReadAt }));
                receiptState = readers.length > 0 ? 'read' : 'sent';
              }
            }
            return (
              <QuickChatBubble
                key={item.key}
                message={message}
                isMine={isMine}
                isGroupStart={item.isGroupStart}
                isGroupEnd={item.isGroupEnd}
                receiptState={receiptState}
                readers={readers}
                onRetry={onRetry}
                onDiscard={onDiscard}
              />
            );
          })
        )}
      </div>
      {newCount > 0 ? (
        <Button
          type='button'
          size='sm'
          variant='secondary'
          data-testid='quick-chat-new-messages'
          className={cn('absolute bottom-3 left-1/2 h-9 -translate-x-1/2 rounded-full shadow-sm')}
          onClick={() => scrollToBottom('smooth')}
        >
          <Icons.chevronsDown aria-hidden />
          {quickChatText.newMessages(newCount)}
        </Button>
      ) : null}
    </>
  );
}
