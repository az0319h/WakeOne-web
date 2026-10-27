/**
 * plan 93 — 「퀵 대화」 FE 문구·상수.
 * 서버 문구·역할 라벨·칩은 `schemas/quick-request-chat.ts`(BE 공용), 캐시 타입·merge는 `lib/quick-chat-cache.ts`.
 */

export const QUICK_CHAT_PAGE_TITLE = '퀵 대화';
export const QUICK_CHAT_PAGE_DESCRIPTION = '요청 건별 대화 · 최근 7일 + 안 읽은 대화';

export const QUICK_CHAT_TEXT = {
  listTitle: '퀵 대화',
  listAriaLabel: '퀵 대화 목록',
  realtimeOn: '실시간',
  realtimeConnecting: '연결 중…',
  searchPlaceholder: '요청번호·요청자·주소 검색',
  tabAll: '전체',
  tabUnread: '안 읽음',
  listEmptyAll: '대화할 수 있는 퀵 요청이 없습니다.',
  listEmptySearch: '검색 결과가 없습니다.',
  listEmptyUnread: '안 읽은 대화가 없습니다.',
  noLastMessage: '아직 대화가 없습니다',
  noSelection: '왼쪽에서 대화를 선택하세요',
  notFound: '대화를 찾을 수 없습니다.',
  loadFailed: '대화를 불러오지 못했습니다.',
  listLoadFailed: '대화 목록을 불러오지 못했습니다.',
  backToList: '목록',
  backToDetail: '상세로',
  detailLink: '상세 보기',
  detailChatTitle: '요청 대화',
  chatButton: '대화',
  messagesAriaLabel: '메시지 목록',
  emptyWritable: '아직 대화가 없습니다. 취소나 시간 변경 같은 요청을 남겨 보세요.',
  emptyReadOnly: '아직 대화가 없습니다.',
  unreadDivider: '여기부터 새 메시지',
  composerPlaceholder: '메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)',
  composerLabel: '메시지',
  send: '전송',
  quickReplies: '빠른 답장',
  tooLong: '1,000자를 넘었습니다',
  receiptPending: '전송 중',
  receiptSent: '전송됨',
  receiptRead: '읽음',
  receiptUnreadTooltip: '아직 읽지 않았습니다',
  sendFailed: '전송 실패 ·',
  retry: '다시 보내기',
  discard: '삭제'
} as const;

export const quickChatText = {
  newMessages: (count: number) => `새 메시지 ${count} ↓`,
  remaining: (count: number) => `남은 글자 ${count}`,
  unreadBadge: (count: number) => `안 읽은 메시지 ${count}개`,
  newConversations: (count: number | string) => `새 대화 ${count}`,
  newConversationsLink: (requestNo: string, count: number) => `${requestNo} 새 대화 ${count}건 보기`,
  summary: (conversations: number, unread: number) =>
    `대화 ${conversations}건 · 안 읽은 대화 ${unread}건`,
  readAt: (name: string, time: string) => `${name} · ${time} 읽음`,
  detailLinkLabel: (requestNo: string) => `${requestNo} 상세 보기`,
  chatButtonLabel: (count: number) => (count > 0 ? `대화 · 안 읽은 메시지 ${count}개` : '대화')
} as const;

/** 카운터가 나타나는 글자 수 (U-6) */
export const QUICK_CHAT_COUNTER_THRESHOLD = 900;
/** 「새 메시지 N ↓」·자동 스크롤 판정 — 맨 아래에서 이만큼 안이면 「맨 아래 근처」 */
export const QUICK_CHAT_NEAR_BOTTOM_PX = 120;
/** 읽음 갱신 debounce (C-11) */
export const QUICK_CHAT_MARK_READ_DEBOUNCE_MS = 500;
/** 「입력 중…」 송신 throttle · 수신 자동 해제 (C-20 · C-23) */
export const QUICK_CHAT_TYPING_THROTTLE_MS = 3000;
export const QUICK_CHAT_TYPING_TTL_MS = 4000;
/** 목록·전역 Realtime invalidate debounce */
export const QUICK_CHAT_LIST_REALTIME_DEBOUNCE_MS = 300;
export const QUICK_CHAT_UNREAD_REALTIME_DEBOUNCE_MS = 1000;
/** 상세 aside 「요청 대화」 카드는 xl(≥1280)에서만 · 그 아래는 `?chat=1` 전체 뷰 (designer §4.3) */
export const QUICK_CHAT_DETAIL_ASIDE_MEDIA_QUERY = '(min-width: 1280px)';
/** 모바일 키보드 높이 보정 훅은 lg 미만에서만 (designer §4.10) */
export const QUICK_CHAT_MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

export function quickChatHref(requestNo: string): string {
  return `/dashboard/quick/chat?request=${encodeURIComponent(requestNo)}`;
}
