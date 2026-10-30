/**
 * plan 93 — 「퀵 대화」 FE 문구·상수.
 * 서버 문구·역할 라벨·칩은 `schemas/quick-request-chat.ts`(BE 공용), 캐시 타입·merge는 `lib/quick-chat-cache.ts`.
 */

export const QUICK_CHAT_PAGE_TITLE = '퀵 대화';
/** plan 97 — 기간은 목록 패널에서 선택 (안 읽은 대화는 기간과 무관하게 포함) */
export const QUICK_CHAT_PAGE_DESCRIPTION = '요청 건별 대화 · 선택한 기간 + 안 읽은 대화';

export const QUICK_CHAT_TEXT = {
  listTitle: '퀵 대화',
  listAriaLabel: '퀵 대화 목록',
  /** plan 97 U-3 — 무한스크롤 센티널 */
  loadingMore: '불러오는 중…',
  listEnd: '더 이상 대화가 없습니다',
  loadMore: '더 보기',
  rangeAriaLabel: '조회 기간',
  realtimeOn: '실시간',
  realtimeConnecting: '연결 중…',
  /** plan 94 D-4 — 구독 실패 시 5초 polling */
  realtimePolling: '폴링',
  realtimePollingHint: '실시간 연결이 안 돼 5초마다 새로고침합니다',
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
  /** mobile-ux 2차 #3 — 360 입력칸(본문 ≈128px)에서도 1줄. 키 안내는 `composerHint`(sr-only · aria-describedby) · plan 106 끝 줄임표 */
  composerPlaceholder: '메시지 입력…',
  composerHint: 'Enter 전송, Shift+Enter 줄바꿈',
  /** plan 106 D-13 ① — 터치 기기(`pointer: coarse`)는 Enter = 줄바꿈 */
  composerHintTouch: 'Enter는 줄바꿈, 보내기는 전송 버튼',
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
  discard: '삭제',
  /** plan 98 — 파일 첨부 (U-1 · U-2 · 3-1 · 3-2) */
  attach: '파일 첨부',
  attachmentTray: '첨부 대기 파일',
  dropHint: '파일을 여기에 놓으세요',
  dropSubHint: '이미지·PDF·문서·ZIP · 파일당 10MB · 최대 30개',
  uploading: '업로드 중…',
  uploadFailed: '업로드 실패',
  retryUpload: '다시 올리기',
  waitUpload: '업로드가 끝나면 보낼 수 있습니다',
  fixFailed: '실패한 파일을 다시 올리거나 제거하세요',
  imageLoadFailed: '이미지를 불러오지 못했습니다. 다시 시도',
  /** plan 101 — 참여자 (U-1 ~ U-4 · U-7) */
  participants: '참여자',
  participantsDescription: '요청 대화에 참여 중인 사람',
  participantsListAriaLabel: '참여자 목록',
  addParticipant: '참여자 추가',
  backToParticipants: '참여자 목록으로',
  participantSearchPlaceholder: '이름 또는 이메일 검색',
  participantSearchHint: '이름 또는 이메일을 입력하세요',
  candidatesEmpty: '검색 결과가 없습니다.',
  leave: '나가기',
  leaveTitle: '대화 나가기',
  leaveDescription: '이 대화에서 나가면 더 이상 메시지를 볼 수 없습니다.',
  leaveConfirm: '나가기',
  removeTitle: '참여자 제외',
  removeConfirm: '제외',
  cancel: '취소',
  me: '(나)',
  participantBadge: '참여',
  participantBadgeLabel: '초대된 참여자로 보는 요청',
  close: '닫기',
  /** plan 100 — AI 답장 추천 (designer §4-3 · 배지 tooltip은 D-8 원문) */
  aiBadge: 'AI 추천',
  aiBadgeTooltip: '대화 내용을 바탕으로 AI가 제안한 문장입니다. 보내기 전에 확인하세요.',
  aiLoading: '추천 중…',
  /** plan 106 D-12 · designer §5.5 — 전체 화면 대화 상단바 「⋯」 */
  more: '더보기',
  /** plan 106 §5.3 · K15 — 대화 목록 기간 판 (lg 미만) */
  filterTitle: '필터',
  filterDescription: '대화 목록 기간을 고르면 바로 적용됩니다.',
  filterButton: '기간',
  filterButtonAria: '기간 필터'
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
  chatButtonLabel: (count: number) => (count > 0 ? `대화 · 안 읽은 메시지 ${count}개` : '대화'),
  /** plan 98 */
  removeAttachment: (name: string) => `${name} 제거`,
  retryAttachment: (name: string) => `${name} 다시 올리기`,
  download: (name: string) => `${name} 다운로드`,
  viewImage: (name: string) => `${name} 크게 보기`,
  openFile: (name: string) => `${name} 열기`,
  moreImages: (count: number) => `사진 ${count}장 더 보기`,
  attachCount: (count: number, max: number) => `${count}/${max}`,
  uploadProgress: (name: string) => `${name} 업로드 진행률`,
  /** plan 101 */
  participantsLabel: (count: number) => `참여자 ${count}`,
  participantsAria: (count: number) => `참여자 ${count}명 보기`,
  invited: (name: string) => `${name}님을 초대했습니다.`,
  removed: (name: string) => `${name}님을 제외했습니다.`,
  left: () => '대화에서 나갔습니다.',
  removeDescription: (name: string) => `${name}님을 이 대화에서 제외할까요? 이후 메시지를 볼 수 없습니다.`,
  removeAria: (name: string) => `${name} 제외`,
  invitedBy: (name: string, time: string) => `초대: ${name} · ${time}`,
  systemJoined: (name: string, time: string) => `${name}님이 참여했습니다 · ${time}`,
  systemRemoved: (name: string, time: string) => `${name}님이 제외되었습니다 · ${time}`,
  systemLeft: (name: string, time: string) => `${name}님이 나갔습니다 · ${time}`,
  /** plan 100 — 추천이 칩에 들어온 순간 스크린리더 안내 (`aria-live='polite'`) */
  aiReadyLive: (count: number) => `AI 답장 추천 ${count}개`,
  /** plan 106 §6.9 — 상세 대화 상단바 둘째 줄 */
  detailChatSubtitle: (from: string, to: string) => `요청 대화 · ${from} → ${to}`,
  /** plan 106 §5.4 — 대화방 상단바 둘째 줄 */
  messengerSubtitle: (from: string, to: string, requester: string) => `${from} → ${to} · ${requester}`
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
/** plan 101 U-3 — 초대 후보 검색 debounce */
export const QUICK_CHAT_PARTICIPANT_SEARCH_DEBOUNCE_MS = 300;
/** plan 100 D-2 — 상대 메시지 연속 수신을 묶어 추천 1회 (대화를 처음 열 때도 1초 뒤 · 빠르게 넘겨 보는 대화는 호출 0) */
export const QUICK_CHAT_AI_DEBOUNCE_MS = 1000;
/** plan 100 — 추천 대기가 이보다 길 때만 오른쪽 칸에 스피너 (짧은 응답에 깜빡임 0) */
export const QUICK_CHAT_AI_LOADING_DELAY_MS = 300;
/** plan 100 AC-03 — 건별 최신 추천 1건 (sessionStorage · 같은 탭 새로고침 재호출 0). 키 = prefix + requestNo */
export const QUICK_CHAT_AI_STORAGE_PREFIX = 'wakeone:quick-chat-ai:v1:';
/** plan 100 D-6 — 429를 받은 KST 날짜 (sessionStorage · 그날은 더 호출하지 않음). 키 = prefix + YYYY-MM-DD */
export const QUICK_CHAT_AI_LIMIT_STORAGE_PREFIX = 'wakeone:quick-chat-ai:limit:';
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
