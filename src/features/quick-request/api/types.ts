import type {
  QuickRequestGoodsSize as GoodsSize,
  QuickRequestNotifyBody,
  QuickRequestVehicleType
} from '../schemas/quick-request-notify';
import type {
  QuickChatAiErrorReason,
  QuickChatAiSource,
  QuickChatAuthorRole,
  QuickChatConversationTab,
  QuickChatReadOnlyReason,
  QuickChatViewerRole
} from '../schemas/quick-request-chat';
import type { QuickChatAttachmentKind } from '../schemas/quick-request-attachment';
import type { QuickChatParticipantEventType } from '../schemas/quick-request-participant';
import type { QuickRequestStatus } from '../schemas/quick-request-workflow';
import type { QuickRequestRecentAddressDirection } from '../schemas/quick-request-recent-address';
import type { QuickRangeKind } from '../lib/quick-request-range';

export type { QuickRequestFormValues } from '../schemas/quick-request-form';

export type QuickRequestLocation = {
  roadAddress: string;
  detailAddress: string;
  contactName: string;
  contactPhone: string;
};

export type QuickRequestNotifyPayload = QuickRequestNotifyBody;

export type { QuickRequestVehicleType };

export type { QuickRequestGoodsSize } from '../schemas/quick-request-notify';

// ---------------------------------------------------------------------------
// plan 87 — 특이사항 칩 (GET/POST /api/quick-request/notes · PATCH/DELETE /notes/[id])
// ---------------------------------------------------------------------------

export type QuickRequestNote = {
  id: number;
  label: string;
};

export type QuickRequestNoteMutationPayload = {
  label: string;
};

/** 실패 응답 공통 형태 (`message`는 사용자에게 그대로 표시) */
export type QuickRequestApiError = {
  success: false;
  message: string;
};

export type QuickRequestNotesListResponse = {
  success: true;
  data: { notes: QuickRequestNote[] };
};

/** POST 201 */
export type QuickRequestNoteCreateResponse = {
  success: true;
  data: { note: QuickRequestNote };
};

/** PATCH 200 — `previousLabel`로 폼 선택값을 치환한다 */
export type QuickRequestNoteUpdateResponse = {
  success: true;
  data: { note: QuickRequestNote; previousLabel: string };
};

/** DELETE 200 — `label`로 폼 선택값을 제거한다 */
export type QuickRequestNoteDeleteResponse = {
  success: true;
  data: { id: number; label: string };
};

// ---------------------------------------------------------------------------
// plan 87 — 최근 주소 (GET/POST /api/quick-request/recent-addresses)
// ---------------------------------------------------------------------------

export type { QuickRequestRecentAddressDirection };

/** `contactPhone`은 숫자만(9~11자리 · plan 97). 표시는 `formatPhoneDisplay`. `id`는 FE dedupe·key (plan 97) */
export type QuickRequestRecentAddress = QuickRequestLocation & {
  id: number;
  direction: QuickRequestRecentAddressDirection;
  lastUsedAt: string;
};

/** GET /api/quick-request/recent-addresses?direction=origin|destination&cursor&limit(기본 10 · ≤50) — plan 97 D-9 커서 목록 */
export type QuickRequestRecentAddressesListResponse = {
  success: true;
  data: { addresses: QuickRequestRecentAddress[]; nextCursor: string | null };
};

/** POST body item — 출발 칸 `origin` · 경유·도착 칸 `destination` */
export type QuickRequestRecentAddressItem = QuickRequestLocation & {
  direction: QuickRequestRecentAddressDirection;
};

/** 출발 → 경유 → 도착 순서. 앞쪽 항목이 더 최근으로 정렬된다 */
export type QuickRequestRecentAddressesRecordPayload = {
  locations: QuickRequestRecentAddressItem[];
};

export type QuickRequestRecentAddressesRecordResponse = {
  success: true;
  data: { count: number };
};

// ---------------------------------------------------------------------------
// plan 89 — 퀵 업무 흐름 (등록·목록·요약·상세·수정·접수·배차·승인·취소)
// ---------------------------------------------------------------------------

export type { QuickRequestStatus } from '../schemas/quick-request-workflow';

export type QuickRequestOriginSchedule =
  | { mode: 'immediate' }
  | { mode: 'scheduled'; datetimeIso: string };

export type QuickRequestDestinationSchedule =
  | { mode: 'asap' }
  | { mode: 'scheduled'; datetimeIso: string };

export type QuickRequestOriginDetail = QuickRequestLocation & {
  schedule: QuickRequestOriginSchedule;
  notes: string[];
  memo: string | null;
};

export type QuickRequestDestinationDetail = QuickRequestLocation & {
  schedule: QuickRequestDestinationSchedule;
  notes: string[];
  memo: string | null;
};

/** 표·카드 경로 문자열 — 도로명주소 앞 두 토큰 (예: `서울 용산구`) */
export type QuickRequestRouteSummary = {
  from: string;
  to: string;
  stopoverCount: number;
};

/** 목록 행 업무 처리 버튼 (서버가 역할·상태로 계산) */
export type QuickRequestRowActions = {
  accept: boolean;
  dispatch: boolean;
  /** dispatched · 동방/admin · 최종금액 없음 */
  setFinal: boolean;
  /** dispatched · 요청자/admin (최종금액 유무와 무관 — 없으면 FE가 「최종금액 대기」) */
  approve: boolean;
};

export type QuickRequestListRow = {
  id: string;
  requestNo: string;
  status: QuickRequestStatus;
  requestedAt: string;
  requester: { userId: string; name: string };
  route: QuickRequestRouteSummary;
  goodsSize: GoodsSize;
  itemDescription: string;
  vehicleTypes: string[];
  vehicleOtherText: string | null;
  vehicleCount: number;
  estimatedAmount: number | null;
  finalAmount: number | null;
  actions: QuickRequestRowActions;
  /** plan 93 — 내가 안 읽은 대화 메시지 수 (「새 대화 N」 배지 · 0이면 숨김) */
  unreadMessageCount: number;
  /** plan 101 U-7 — 초대된 참여자로 보는 건 (「참여」 배지). 요청자·viewer-all이면 false */
  isParticipant: boolean;
};

export type QuickRequestStatusCounts = Record<QuickRequestStatus, number>;

export type QuickRequestViewer = {
  scope: 'own' | 'all';
  canOperate: boolean;
  canCreate: boolean;
};

/** plan 97 D-1 — 조회 기간 (대시보드·요약·대화 공통). `range` 없으면 7d · `from`/`to`는 custom일 때만 `yyyy-MM-dd` */
export type QuickRequestRangeFilters = {
  range?: QuickRangeKind | null;
  from?: string | null;
  to?: string | null;
};

/** 서버가 실제 적용한 기간 에코 (`all`이면 from/to null) */
export type QuickRequestRangeEcho = {
  kind: QuickRangeKind;
  from: string | null;
  to: string | null;
};

export type QuickRequestListFilters = QuickRequestRangeFilters & {
  status?: QuickRequestStatus | null;
  search?: string | null;
  page?: number;
  /** 10 · 20 · 50 (서버 ≤50 클램프 · 기본 20) */
  limit?: number;
};

/** GET /api/quick-request — plan 97 D-3 DB 페이지네이션. 카드 숫자(`counts`)는 `/summary`로 분리 */
export type QuickRequestListResponse = {
  success: true;
  data: {
    rows: QuickRequestListRow[];
    total: number;
    page: number;
    limit: number;
    range: QuickRequestRangeEcho;
    viewer: QuickRequestViewer;
  };
};

export type QuickRequestSummary = {
  counts: QuickRequestStatusCounts;
  /** 선택 기간 (KST `yyyy-MM-dd` · `all`이면 null) */
  range: { kind: QuickRangeKind; fromDate: string | null; toDate: string | null };
  viewer: QuickRequestViewer;
};

/** GET /api/quick-request/summary?range&from&to — status·search 무시 (plan 97 D-4) */
export type QuickRequestSummaryResponse = {
  success: true;
  data: QuickRequestSummary;
};

export type QuickRequestActorRef = { name: string } | null;

export type QuickRequestHistory = {
  acceptedAt: string | null;
  acceptedBy: QuickRequestActorRef;
  dispatchedAt: string | null;
  dispatchedBy: QuickRequestActorRef;
  finalAmountSetAt: string | null;
  finalAmountSetBy: QuickRequestActorRef;
  approvedAt: string | null;
  approvedBy: QuickRequestActorRef;
  cancelledAt: string | null;
  cancelledBy: QuickRequestActorRef;
  cancelReason: string | null;
};

export type QuickRequestPermissions = {
  canEdit: boolean;
  canAccept: boolean;
  canDispatch: boolean;
  canSetFinal: boolean;
  canApprove: boolean;
  canCancel: boolean;
  /** 동방·admin (운영 권한). 취소 Alert 등 FE 분기용 (plan 92에서 이름 변경) */
  canOperate: boolean;
  /** plan 101 D-4 — 초대 참여자(읽기·대화만). true면 나머지는 전부 false */
  isParticipant: boolean;
};

export type QuickRequestDetail = {
  id: string;
  requestNo: string;
  status: QuickRequestStatus;
  requestedAt: string;
  requester: { userId: string; name: string; phone: string | null };
  goodsSize: GoodsSize;
  itemDescription: string;
  vehicleTypes: string[];
  vehicleOtherText: string | null;
  vehicleCount: number;
  freightPayment: 'monthly' | 'collect';
  origin: QuickRequestOriginDetail;
  stopovers: QuickRequestLocation[];
  destination: QuickRequestDestinationDetail;
  dispatch: {
    estimatedAmount: number | null;
    vehicleInfo: string | null;
    driverName: string | null;
    driverPhone: string | null;
  };
  finalAmount: number | null;
  history: QuickRequestHistory;
  permissions: QuickRequestPermissions;
};

/** GET /api/quick-request/[requestNo] */
export type QuickRequestDetailResponse = {
  success: true;
  data: QuickRequestDetail;
};

/** POST /api/quick-request — 201 */
export type QuickRequestCreateResponse = {
  success: true;
  data: { requestNo: string; id: string };
};

/** 변경 API 공통 200 (PATCH · accept · dispatch · approve · cancel) */
export type QuickRequestMutationResponse = {
  success: true;
  data: {
    requestNo: string;
    status: QuickRequestStatus;
  };
};

export type {
  QuickRequestCancelBody as QuickRequestCancelPayload,
  QuickRequestCreateBody as QuickRequestCreatePayload,
  QuickRequestDispatchBody as QuickRequestDispatchPayload,
  QuickRequestPatchBody as QuickRequestPatchPayload,
} from '../schemas/quick-request-workflow';

// ---------------------------------------------------------------------------
// plan 93 — 퀵 요청 건별 대화 (messages · read · conversations · unread-total)
// ---------------------------------------------------------------------------

export type {
  QuickChatAiErrorReason,
  QuickChatAiSource,
  QuickChatAuthorRole,
  QuickChatConversationTab,
  QuickChatReadOnlyReason,
  QuickChatViewerRole
} from '../schemas/quick-request-chat';

/** plan 98 — 메시지 첨부 (URL은 지연 조회 · `GET …/attachments/{id}/url`). `mimeType`은 lightbox `content_type`용 */
export type QuickRequestMessageAttachment = {
  id: number;
  kind: QuickChatAttachmentKind;
  fileName: string;
  /** bytes */
  fileSize: number;
  /** 소문자 · 예 `docx` */
  extension: string;
  /** `application/octet-stream`이면 확장자로 판정 */
  mimeType: string;
};

export type QuickRequestMessage = {
  /** bigint identity — 읽음 위치·안 읽은 수는 id 비교 */
  id: number;
  authorUserId: string;
  authorName: string;
  authorRole: QuickChatAuthorRole;
  /** plan 98 — 첨부만 있는 메시지는 `''` */
  body: string;
  createdAt: string;
  /** plan 98 — 빈 배열이라도 항상 존재 */
  attachments: QuickRequestMessageAttachment[];
};

/** 읽음 위치 (본인 포함 전원 · FE가 C-12 상대편만 골라 ✓✓ 판정) */
export type QuickRequestMessageRead = {
  userId: string;
  name: string;
  role: QuickChatViewerRole;
  lastReadMessageId: number;
  lastReadAt: string;
};

/** 대화 헤더·Realtime 필터(`id`)·typing 채널명(`quick-chat-{id}`)용 */
export type QuickRequestChatRequestSummary = {
  id: string;
  requestNo: string;
  status: QuickRequestStatus;
  requesterUserId: string;
  requesterName: string;
  route: QuickRequestRouteSummary;
  requestedAt: string;
};

/** isMine · ✓✓ 상대편 · 칩 세트 · optimistic authorName/authorRole */
export type QuickRequestChatViewer = {
  userId: string;
  name: string;
  role: QuickChatViewerRole;
  /** plan 101 D-1 — 참여자 초대·제외 가능 (요청자 본인 · admin) */
  canManageParticipants: boolean;
};

/** plan 101 — 대화 참여자 1명 (요청자 · active 동방 · 글 쓴 admin · 초대 참여자) */
export type QuickRequestParticipant = {
  userId: string;
  name: string;
  role: QuickChatAuthorRole;
  /** 초대 참여자만 (그 밖은 null) */
  invitedBy: { userId: string; name: string } | null;
  /** ISO · 초대 참여자만 */
  invitedAt: string | null;
};

/** plan 101 D-7 — 시스템 줄 파생용 이벤트 (`left` = 본인 나가기). 시각순 */
export type QuickRequestParticipantEvent = {
  type: QuickChatParticipantEventType;
  userId: string;
  name: string;
  at: string;
};

/** plan 101 D-2 — 초대 후보 (이름·이메일·소속만) */
export type QuickRequestParticipantCandidate = {
  userId: string;
  name: string;
  email: string;
  affiliationLabel: string | null;
};

/** GET …/participants */
export type QuickRequestParticipantsData = {
  participants: QuickRequestParticipant[];
  events: QuickRequestParticipantEvent[];
};

export type QuickRequestParticipantsResponse = { success: true; data: QuickRequestParticipantsData };

/** GET …/participants/candidates?q= */
export type QuickRequestParticipantCandidatesResponse = {
  success: true;
  data: { candidates: QuickRequestParticipantCandidate[] };
};

/** POST …/participants `{ userId }` — 201 */
export type QuickRequestParticipantInvitePayload = { userId: string };
export type QuickRequestParticipantInviteResponse = {
  success: true;
  data: { participant: QuickRequestParticipant };
};

/** DELETE …/participants/[userId] — 200 (`self` = 본인 나가기) */
export type QuickRequestParticipantRemoveResponse = {
  success: true;
  data: { userId: string; self: boolean };
};

export type QuickRequestMessagesData = {
  request: QuickRequestChatRequestSummary;
  viewer: QuickRequestChatViewer;
  /** plan 101 — 요청자 → 동방(이름순) → 글 쓴 admin → 초대 참여자(invitedAt순) */
  participants: QuickRequestParticipant[];
  /** plan 101 D-7 — 시각순 (시스템 줄은 FE `groupMessages`가 파생) */
  events: QuickRequestParticipantEvent[];
  /** 오름차순 · 최근 500 */
  messages: QuickRequestMessage[];
  /** 읽음 위치 없으면 0 */
  myLastReadMessageId: number;
  reads: QuickRequestMessageRead[];
  canWrite: boolean;
  readOnlyReason: QuickChatReadOnlyReason | null;
  /** 역할별 3/4개 · 읽기 전용이면 [] */
  quickReplies: string[];
  /** plan 100 D-1 — `enabled` = env ON(`QUICK_CHAT_AI_SUGGEST=1` + 키) && canWrite. false면 FE는 suggest를 호출하지 않는다 */
  aiSuggest: QuickRequestAiSuggestConfig;
};

/** GET /api/quick-request/[requestNo]/messages */
export type QuickRequestMessagesResponse = {
  success: true;
  data: QuickRequestMessagesData;
};

/** plan 98 — `body`는 `''` 허용(첨부 ≥ 1일 때) · `attachmentIds`는 prepare 응답 id(업로드 완료분) */
export type QuickRequestMessageCreatePayload = { body: string; attachmentIds?: number[] };

/** POST …/messages — 201 */
export type QuickRequestMessageCreateResponse = {
  success: true;
  data: { message: QuickRequestMessage };
};

export type QuickRequestMarkReadPayload = { lastMessageId: number };

/** PUT …/messages/read — 200 (greatest 유지 · 그 건 chat_message 알림 본인 unread → read) */
export type QuickRequestMarkReadResponse = {
  success: true;
  data: { lastReadMessageId: number; notificationsMarkedRead: number };
};

// ---------------------------------------------------------------------------
// plan 100 — 퀵 대화 AI 답장 추천 (POST …/messages/suggest)
// ---------------------------------------------------------------------------

export type QuickRequestAiSuggestConfig = { enabled: boolean };

/** POST …/messages/suggest — 그 건의 현재 마지막 메시지(남이 보낸 것) id */
export type QuickRequestAiSuggestPayload = { lastMessageId: number };

/** 200 data — `suggestions`는 항상 4개(AI 먼저 → 부족분 규칙 칩). `source:'rules'`면 AI 문장 0개(배지 없음) */
export type QuickRequestAiSuggestData = {
  suggestions: string[];
  source: QuickChatAiSource;
  lastMessageId: number;
  /** 오늘(KST) 사용량 — 이번 호출 포함 */
  usage: { count: number; limit: number };
  /** `E2E_ANTHROPIC_MOCK=echo` 전용 — 모델에 보낸(마스킹된) user content */
  debugPrompt?: string;
};

export type QuickRequestAiSuggestResponse = { success: true; data: QuickRequestAiSuggestData };

/** 오류 응답 (409 stale · 429 limit · 502 failed · 503 disabled · 그 밖 failed) */
export type QuickRequestAiSuggestErrorResponse = {
  success: false;
  message: string;
  reason: QuickChatAiErrorReason;
};

/**
 * FE 정규화 결과 (`service.suggestQuickChatReplies`) — abort 외에는 throw하지 않는다(designer §10 ⑤).
 * - `ai`: 200 + source ai → 칩 교체 + 「AI 추천」 배지
 * - `rules`: 200 source rules(`no_ai`) · 409(`stale`) · 429(`limit`) · 503(`disabled`) · 그 밖 HTTP·네트워크(`failed`) → 규칙 칩 유지 · 토스트 0
 */
export type QuickChatAiSuggestResult =
  | {
      source: 'ai';
      lastMessageId: number;
      suggestions: string[];
      usage: { count: number; limit: number };
    }
  | {
      source: 'rules';
      lastMessageId: number;
      reason: QuickChatAiErrorReason | 'no_ai';
    };

export type QuickRequestConversationLastMessage = {
  id: number;
  authorName: string;
  authorRole: QuickChatAuthorRole;
  /** 120자 trim */
  body: string;
  createdAt: string;
};

export type QuickRequestConversation = QuickRequestChatRequestSummary & {
  lastMessage: QuickRequestConversationLastMessage | null;
  unreadCount: number;
  /** plan 101 — 초대된 참여자로 보는 건 */
  isParticipant: boolean;
};

export type QuickRequestConversationsFilters = QuickRequestRangeFilters & {
  q?: string | null;
  tab?: QuickChatConversationTab;
  /** 기본 20 · ≤50 */
  limit?: number;
};

export type QuickRequestConversationsTotals = { conversations: number; unreadConversations: number };

export type QuickRequestConversationsData = {
  /** 마지막 메시지 시각 desc → 메시지 없는 건 requestedAt desc · 페이지 20건 (plan 97 D-5) */
  conversations: QuickRequestConversation[];
  /** opaque base64 — 다음 페이지 요청에 그대로 `cursor`로 보낸다. 끝이면 null */
  nextCursor: string | null;
  /** 첫 페이지(cursor 없음)에만 · tab 무관 (q 적용 후) */
  totals?: QuickRequestConversationsTotals;
};

/** GET /api/quick-request/conversations?q&tab=all|unread&range&from&to&cursor&limit */
export type QuickRequestConversationsResponse = {
  success: true;
  data: QuickRequestConversationsData;
};

// ---------------------------------------------------------------------------
// plan 98 — 퀵 대화 첨부 (prepare · delete pending · url · download)
// ---------------------------------------------------------------------------

export type { QuickChatAttachmentKind };

/** POST …/messages/attachments/prepare body — 1~30 · `mime`은 브라우저 `file.type`(비어 있으면 생략 가능) */
export type QuickRequestAttachmentPreparePayload = {
  files: { name: string; size: number; mime?: string | null }[];
};

/** prepare 응답 항목 — `uploadUrl`은 브라우저가 그대로 PUT(`Content-Type: file.type || application/octet-stream`) */
export type QuickRequestMessageAttachmentPrepared = {
  attachmentId: number;
  uploadUrl: string;
  token: string;
  storagePath: string;
};

/** POST …/messages/attachments/prepare — 201 (순서 = 요청 `files` 순서) */
export type QuickRequestAttachmentPrepareResponse = {
  success: true;
  data: { attachments: QuickRequestMessageAttachmentPrepared[] };
};

/** DELETE …/messages/attachments/[id] — 200 (pending만 · 연결됨 409 · 타인·미존재 404) */
export type QuickRequestAttachmentDeleteResponse = {
  success: true;
  data: { id: number };
};

/** GET …/messages/attachments/[id]/url — 200 (서명 URL 60초) */
export type QuickRequestAttachmentUrlResponse = {
  success: true;
  data: { url: string; expiresAt: string };
};

/** GET /api/quick-request/unread-total — 90일 상한 */
export type QuickRequestUnreadTotalResponse = {
  success: true;
  data: { total: number };
};

// ---------------------------------------------------------------------------
// plan 99 — 「장소 검색」 탭 (외부 장소 키워드 검색 · 서버 프록시)
// ---------------------------------------------------------------------------

/** 정규화된 장소 1건 (외부 응답 → WakeOne 형태 · `places.server.ts`) */
export type QuickRequestPlace = {
  /** 외부 장소 id */
  id: string;
  /** 장소명 → 선택 시 상세주소 칸(비어 있을 때만) */
  name: string;
  /** 도로명 주소 · 없으면 null (FE는 지번 + 「지번」 배지) */
  roadAddress: string | null;
  /** 지번 주소 */
  address: string;
  /** 대표 전화 · 없으면 null (담당자 연락처 아님) */
  phone: string | null;
  /** 카테고리 마지막 단계 (`음식점 > 카페` → `카페`) · 없으면 null */
  category: string | null;
};

/** GET /api/quick-request/places?q=&page= — `data` */
export type QuickRequestPlacesPage = {
  places: QuickRequestPlace[];
  /** 외부 meta.is_end (마지막 페이지 여부) */
  isEnd: boolean;
  /** 외부 meta.pageable_count (받을 수 있는 건수 · 최대 45) */
  total: number;
  /** 요청 page (1~3) */
  page: number;
  /** 0건이라 단어 순서를 뒤집어 다시 찾았고 그 결과가 있으면 그 검색어 · 아니면 null */
  matchedQuery: string | null;
};

export type QuickRequestPlacesResponse = { success: true; data: QuickRequestPlacesPage };
