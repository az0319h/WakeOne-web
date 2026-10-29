'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { QuickChatConversationList } from './quick-chat-conversation-list';
import { QuickChatConversationPane } from './quick-chat-conversation-pane';
import type { QuickRealtimeStatus } from '../../lib/use-quick-realtime-channel';
import { QuickChatListRealtime } from './quick-chat-list-realtime';
import { useQuickChatParams } from './use-quick-chat-params';
import { useVisualViewportHeight } from './use-visual-viewport-height';

type QuickChatMessengerProps = {
  /** plan 94 D-3 — 목록 Broadcast topic (`quick-requests:all` 또는 `quick-user:{uid}` · 서버 page가 권한 판정) */
  realtimeTopic: string;
};

/**
 * plan 93 U-1 — 「퀵 대화」 2단 Messenger. lg 이상은 목록+대화, lg 미만은 `request` 유무로 하나만 (AC-03).
 * 높이는 `useVisualViewportHeight`가 보이는 뷰포트 기준으로 잡는다(`PageContainer viewportFill`은 overflow만 막는다 · 셸이 min-h-svh라 위에서 못 묶음).
 * 모바일 키보드도 같은 훅이 보정한다. `h-[calc(100dvh-10.5rem)]`은 JS 전 첫 페인트 fallback.
 */
export function QuickChatMessenger({ realtimeTopic }: QuickChatMessengerProps) {
  const { request, q, tab, range, filters, setRequest, setQ, setTab, setRange } = useQuickChatParams();
  const [realtimeStatus, setRealtimeStatus] = useState<QuickRealtimeStatus>('connecting');
  const gridRef = useRef<HTMLDivElement>(null);
  useVisualViewportHeight(gridRef);

  return (
    <div
      ref={gridRef}
      data-testid='quick-chat-messenger'
      className='grid h-[calc(100dvh-10.5rem)] min-h-0 min-w-0 shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]'
    >
      <QuickChatListRealtime topic={realtimeTopic} onStatusChange={setRealtimeStatus} />
      <QuickChatConversationList
        filters={filters}
        q={q}
        tab={tab}
        range={range}
        selectedRequestNo={request}
        realtimeStatus={realtimeStatus}
        onSearchChange={setQ}
        onTabChange={setTab}
        onRangeChange={setRange}
        onSelect={setRequest}
        className={cn(request ? 'hidden lg:flex' : 'flex')}
      />
      <QuickChatConversationPane
        requestNo={request}
        onBack={() => setRequest(null)}
        className={cn(request ? 'flex' : 'hidden lg:flex')}
      />
    </div>
  );
}
