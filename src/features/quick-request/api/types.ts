import type {
  QuickRequestGoodsSize as GoodsSize,
  QuickRequestNotifyBody,
  QuickRequestVehicleType
} from '../schemas/quick-request-notify';
import type {
  QuickChatAuthorRole,
  QuickChatConversationTab,
  QuickChatReadOnlyReason,
  QuickChatViewerRole
} from '../schemas/quick-request-chat';
import type { QuickRequestStatus } from '../schemas/quick-request-workflow';

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

/** `contactPhone`은 숫자만(11자리). 표시는 `formatPhoneDisplay` */
export type QuickRequestRecentAddress = QuickRequestLocation & {
  lastUsedAt: string;
};

export type QuickRequestRecentAddressesListResponse = {
  success: true;
  data: { addresses: QuickRequestRecentAddress[] };
};

/** 출발 → 경유 → 도착 순서. 앞쪽 항목이 더 최근으로 정렬된다 */
export type QuickRequestRecentAddressesRecordPayload = {
  locations: QuickRequestLocation[];
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
};

export type QuickRequestStatusCounts = Record<QuickRequestStatus, number>;

export type QuickRequestViewer = {
  scope: 'own' | 'all';
  canOperate: boolean;
  canCreate: boolean;
};

export type QuickRequestListFilters = {
  status?: QuickRequestStatus | null;
  search?: string | null;
  page?: number;
  limit?: number;
};

/** GET /api/quick-request */
export type QuickRequestListResponse = {
  success: true;
  data: {
    rows: QuickRequestListRow[];
    total: number;
    page: number;
    limit: number;
    counts: QuickRequestStatusCounts;
    viewer: QuickRequestViewer;
  };
};

export type QuickRequestSummary = {
  counts: QuickRequestStatusCounts;
  /** KST `yyyy-MM-dd` */
  range: { fromDate: string; toDate: string };
  viewer: QuickRequestViewer;
};

/** GET /api/quick-request/summary — status·search 무시 */
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
  QuickChatAuthorRole,
  QuickChatConversationTab,
  QuickChatReadOnlyReason,
  QuickChatViewerRole
} from '../schemas/quick-request-chat';

export type QuickRequestMessage = {
  /** bigint identity — 읽음 위치·안 읽은 수는 id 비교 */
  id: number;
  authorUserId: string;
  authorName: string;
  authorRole: QuickChatAuthorRole;
  body: string;
  createdAt: string;
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
};

export type QuickRequestMessagesData = {
  request: QuickRequestChatRequestSummary;
  viewer: QuickRequestChatViewer;
  /** 오름차순 · 최근 500 */
  messages: QuickRequestMessage[];
  /** 읽음 위치 없으면 0 */
  myLastReadMessageId: number;
  reads: QuickRequestMessageRead[];
  canWrite: boolean;
  readOnlyReason: QuickChatReadOnlyReason | null;
  /** 역할별 3/4개 · 읽기 전용이면 [] */
  quickReplies: string[];
};

/** GET /api/quick-request/[requestNo]/messages */
export type QuickRequestMessagesResponse = {
  success: true;
  data: QuickRequestMessagesData;
};

export type QuickRequestMessageCreatePayload = { body: string };

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
};

export type QuickRequestConversationsFilters = {
  q?: string | null;
  tab?: QuickChatConversationTab;
};

export type QuickRequestConversationsData = {
  /** 마지막 메시지 시각 desc → 메시지 없는 건 requestedAt desc · 최대 100 */
  conversations: QuickRequestConversation[];
  /** tab 무관 (q 적용 후) */
  totals: { conversations: number; unreadConversations: number };
};

/** GET /api/quick-request/conversations?q=&tab=all|unread */
export type QuickRequestConversationsResponse = {
  success: true;
  data: QuickRequestConversationsData;
};

/** GET /api/quick-request/unread-total — 90일 상한 */
export type QuickRequestUnreadTotalResponse = {
  success: true;
  data: { total: number };
};
