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

/** 퀵 하단 탭 바 (plan 106 §5.3 — 목록 높이 바닥 경계) */
const QUICK_TABBAR_SELECTOR = '[data-quick-tabbar]';

/**
 * plan 93 U-1 — 「퀵 대화」 2단 Messenger. lg 이상은 목록+대화, lg 미만은 `request` 유무로 하나만 (AC-03).
 * 높이는 `useVisualViewportHeight`가 보이는 뷰포트 기준으로 잡는다(`PageContainer viewportFill`은 overflow만 막는다 · 셸이 min-h-svh라 위에서 못 묶음).
 *
 * plan 106 (lg 미만 · designer K1 · §5.2~5.3):
 * - 목록: 화면 가장자리까지(`-mx-4`) · 높이는 퀵 탭 바 위 16px에서 끝난다(`bottomBoundary` · 페이지 스크롤 0).
 * - 대화방(`request` 있음): **전체 화면** — 루트 `data-quick-fullscreen`(전역 CSS가 공통 상단바·앱 배너·탭 바를 숨기고 문서 스크롤 잠금)
 *   + `PageContainer` 패딩 상쇄 + 높이 = visualViewport(키보드 476에서도 이중 스크롤 0) · 닫기 = `closeRequest`(뒤로 기록 꼬임 T5 해결).
 * - `request`는 nuqs가 SSR에서도 읽으므로 마커가 첫 페인트부터 붙는다. lg 이상에서는 CSS가 `max-width` 안이라 마커가 무해하다.
 * `h-[calc(…)]`·`max-lg:h-…`는 JS 전 첫 페인트 fallback.
 */
export function QuickChatMessenger({ realtimeTopic }: QuickChatMessengerProps) {
  const { request, q, tab, range, filters, setRequest, closeRequest, setQ, setTab, setRange } = useQuickChatParams();
  const [realtimeStatus, setRealtimeStatus] = useState<QuickRealtimeStatus>('connecting');
  const gridRef = useRef<HTMLDivElement>(null);
  const isConversationOpen = request !== null;
  useVisualViewportHeight(
    gridRef,
    isConversationOpen ? { mode: 'fullscreen' } : { bottomBoundary: QUICK_TABBAR_SELECTOR }
  );

  return (
    <div
      ref={gridRef}
      data-testid='quick-chat-messenger'
      data-quick-fullscreen={isConversationOpen ? '' : undefined}
      className={cn(
        'grid h-[calc(100dvh-10.5rem)] min-h-0 min-w-0 shrink-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]',
        'max-lg:-mx-4 md:max-lg:-mx-6',
        isConversationOpen
          ? 'max-lg:-mt-2 max-lg:-mb-4 max-lg:h-dvh max-lg:gap-0 md:max-lg:-mt-4'
          : 'max-lg:h-[calc(100dvh-9.0625rem)]'
      )}
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
        onBack={closeRequest}
        className={cn(request ? 'flex' : 'hidden lg:flex')}
      />
    </div>
  );
}
