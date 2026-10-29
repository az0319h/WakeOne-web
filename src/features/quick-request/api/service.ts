import { apiClientWithMessage } from '@/lib/api-client';
import { appendQuickRangeSearchParams } from '../lib/quick-request-range';
import type {
  QuickChatAiErrorReason,
  QuickChatAiSuggestResult,
  QuickRequestAiSuggestPayload,
  QuickRequestAiSuggestResponse,
  QuickRequestCancelPayload,
  QuickRequestCreatePayload,
  QuickRequestCreateResponse,
  QuickRequestDetail,
  QuickRequestDetailResponse,
  QuickRequestDispatchPayload,
  QuickRequestListFilters,
  QuickRequestListResponse,
  QuickRequestMutationResponse,
  QuickRequestPatchPayload,
  QuickRequestSummary,
  QuickRequestSummaryResponse,
  QuickRequestNote,
  QuickRequestNoteCreateResponse,
  QuickRequestNoteDeleteResponse,
  QuickRequestNoteMutationPayload,
  QuickRequestNoteUpdateResponse,
  QuickRequestNotesListResponse,
  QuickRequestRangeFilters,
  QuickRequestRecentAddressDirection,
  QuickRequestRecentAddressesListResponse,
  QuickRequestConversationsFilters,
  QuickRequestConversationsResponse,
  QuickRequestMarkReadPayload,
  QuickRequestMarkReadResponse,
  QuickRequestAttachmentDeleteResponse,
  QuickRequestAttachmentPreparePayload,
  QuickRequestAttachmentPrepareResponse,
  QuickRequestAttachmentUrlResponse,
  QuickRequestMessageCreatePayload,
  QuickRequestMessageCreateResponse,
  QuickRequestMessagesData,
  QuickRequestMessagesResponse,
  QuickRequestParticipantCandidate,
  QuickRequestParticipantCandidatesResponse,
  QuickRequestPlacesPage,
  QuickRequestPlacesResponse,
  QuickRequestParticipantInviteResponse,
  QuickRequestParticipantRemoveResponse,
  QuickRequestUnreadTotalResponse
} from './types';

// ---------------------------------------------------------------------------
// plan 89 — 퀵 업무 흐름 (오류 시 서버 message를 그대로 Error.message로 던진다)
// ---------------------------------------------------------------------------

const QUICK_REQUEST_PATH = '/api/quick-request';

function quickRequestPath(requestNo: string, suffix = ''): string {
  return `${QUICK_REQUEST_PATH}/${encodeURIComponent(requestNo)}${suffix}`;
}

function buildListQuery(filters: QuickRequestListFilters): string {
  const params = new URLSearchParams();
  appendQuickRangeSearchParams(params, filters);
  if (filters.status) params.set('status', filters.status);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** POST /api/quick-request — 201. `requesterName`·`requestedAtIso`는 서버가 무시한다 */
export async function createQuickRequest(
  payload: QuickRequestCreatePayload
): Promise<QuickRequestCreateResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestCreateResponse>(QUICK_REQUEST_PATH, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.data;
}

export async function fetchQuickRequestList(
  filters: QuickRequestListFilters = {}
): Promise<QuickRequestListResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestListResponse>(
    `${QUICK_REQUEST_PATH}${buildListQuery(filters)}`
  );
  return res.data;
}

/** GET /api/quick-request/summary?range&from&to — 선택 기간 기준 카드 숫자 (plan 97 D-4) */
export async function fetchQuickRequestSummary(
  filters: QuickRequestRangeFilters = {}
): Promise<QuickRequestSummary> {
  const params = new URLSearchParams();
  appendQuickRangeSearchParams(params, filters);
  const query = params.toString();
  const res = await apiClientWithMessage<QuickRequestSummaryResponse>(
    `${QUICK_REQUEST_PATH}/summary${query ? `?${query}` : ''}`
  );
  return res.data;
}

/** 404(권한 없음 포함)는 `null` — 화면 안에서 「퀵 요청을 찾을 수 없습니다.」 (designer K6) */
export async function fetchQuickRequestDetail(requestNo: string): Promise<QuickRequestDetail | null> {
  const response = await fetch(quickRequestPath(requestNo), { credentials: 'include' });
  if (response.status === 404) {
    return null;
  }

  const data = (await response.json()) as QuickRequestDetailResponse & { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? `API error: ${response.status}`);
  }
  return data.data;
}

export async function updateQuickRequest(params: {
  requestNo: string;
  payload: QuickRequestPatchPayload;
}): Promise<QuickRequestMutationResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestMutationResponse>(
    quickRequestPath(params.requestNo),
    { method: 'PATCH', body: JSON.stringify(params.payload) }
  );
  return res.data;
}

/** 최종금액 입력·수정 = PATCH `{ finalAmount }` (dispatched만) */
export async function setQuickRequestFinalAmount(params: {
  requestNo: string;
  finalAmount: number;
}): Promise<QuickRequestMutationResponse['data']> {
  return updateQuickRequest({
    requestNo: params.requestNo,
    payload: { finalAmount: params.finalAmount }
  });
}

export async function acceptQuickRequest(
  requestNo: string
): Promise<QuickRequestMutationResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestMutationResponse>(
    quickRequestPath(requestNo, '/accept'),
    { method: 'POST' }
  );
  return res.data;
}

export async function dispatchQuickRequest(params: {
  requestNo: string;
  payload: QuickRequestDispatchPayload;
}): Promise<QuickRequestMutationResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestMutationResponse>(
    quickRequestPath(params.requestNo, '/dispatch'),
    { method: 'POST', body: JSON.stringify(params.payload) }
  );
  return res.data;
}

export async function approveQuickRequest(
  requestNo: string
): Promise<QuickRequestMutationResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestMutationResponse>(
    quickRequestPath(requestNo, '/approve'),
    { method: 'POST' }
  );
  return res.data;
}

export async function cancelQuickRequest(params: {
  requestNo: string;
  payload?: QuickRequestCancelPayload;
}): Promise<QuickRequestMutationResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestMutationResponse>(
    quickRequestPath(params.requestNo, '/cancel'),
    { method: 'POST', body: JSON.stringify(params.payload ?? {}) }
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// plan 87 — 특이사항 칩 (오류 시 서버 message를 그대로 Error.message로 던진다)
// ---------------------------------------------------------------------------

const NOTES_PATH = '/api/quick-request/notes';
const RECENT_ADDRESSES_PATH = '/api/quick-request/recent-addresses';

export async function fetchQuickRequestNotes(): Promise<QuickRequestNote[]> {
  const res = await apiClientWithMessage<QuickRequestNotesListResponse>(NOTES_PATH);
  return res.data.notes;
}

export async function createQuickRequestNote(
  payload: QuickRequestNoteMutationPayload
): Promise<QuickRequestNoteCreateResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestNoteCreateResponse>(NOTES_PATH, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.data;
}

export async function updateQuickRequestNote(params: {
  id: number;
  payload: QuickRequestNoteMutationPayload;
}): Promise<QuickRequestNoteUpdateResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestNoteUpdateResponse>(
    `${NOTES_PATH}/${params.id}`,
    { method: 'PATCH', body: JSON.stringify(params.payload) }
  );
  return res.data;
}

export async function deleteQuickRequestNote(
  id: number
): Promise<QuickRequestNoteDeleteResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestNoteDeleteResponse>(`${NOTES_PATH}/${id}`, {
    method: 'DELETE'
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// plan 87 — 최근 주소
// ---------------------------------------------------------------------------

/** GET …/recent-addresses?direction&cursor — plan 97 D-9 커서 10건 (`useInfiniteQuery`) */
export async function fetchQuickRequestRecentAddresses(
  direction: QuickRequestRecentAddressDirection,
  cursor: string | null = null
): Promise<QuickRequestRecentAddressesListResponse['data']> {
  const params = new URLSearchParams({ direction });
  if (cursor) params.set('cursor', cursor);
  const res = await apiClientWithMessage<QuickRequestRecentAddressesListResponse>(
    `${RECENT_ADDRESSES_PATH}?${params.toString()}`
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// plan 99 — 「장소 검색」 (서버 프록시 · 브라우저는 외부 API를 직접 부르지 않는다)
// ---------------------------------------------------------------------------

const PLACES_PATH = '/api/quick-request/places';

/**
 * GET /api/quick-request/places?q&page — page 1~3 · 15건씩.
 * 오류 시 서버 message가 Error.message (400·429 「잠시 후 다시 시도해 주세요.」·502·503).
 * 0건이면 서버가 단어 순서를 뒤집어 1회 더 찾고, 찾으면 `matchedQuery`에 그 검색어를 담는다.
 */
export async function fetchQuickRequestPlaces(q: string, page = 1): Promise<QuickRequestPlacesPage> {
  const params = new URLSearchParams({ q, page: String(page) });
  const res = await apiClientWithMessage<QuickRequestPlacesResponse>(`${PLACES_PATH}?${params.toString()}`);
  return res.data;
}

// ---------------------------------------------------------------------------
// plan 93 — 퀵 요청 건별 대화 (오류 시 서버 message를 그대로 Error.message로 던진다 → notifyError)
// ---------------------------------------------------------------------------

function buildConversationsQuery(
  filters: QuickRequestConversationsFilters,
  cursor: string | null
): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.tab && filters.tab !== 'all') params.set('tab', filters.tab);
  appendQuickRangeSearchParams(params, filters);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** GET …/conversations — plan 97 D-5 커서 20건. `cursor`는 직전 응답 `nextCursor`를 그대로 */
export async function fetchQuickRequestConversations(
  filters: QuickRequestConversationsFilters = {},
  cursor: string | null = null
): Promise<QuickRequestConversationsResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestConversationsResponse>(
    `${QUICK_REQUEST_PATH}/conversations${buildConversationsQuery(filters, cursor)}`
  );
  return res.data;
}

/** 404(권한 없음 포함)는 `null` — 「대화를 찾을 수 없습니다.」 (AC-06) */
export async function fetchQuickRequestMessages(
  requestNo: string
): Promise<QuickRequestMessagesData | null> {
  const response = await fetch(quickRequestPath(requestNo, '/messages'), { credentials: 'include' });
  if (response.status === 404) {
    return null;
  }

  const data = (await response.json()) as QuickRequestMessagesResponse & { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? `API error: ${response.status}`);
  }
  return data.data;
}

/** POST …/messages — 201. 400/403/404/409/500 message는 그대로 표시 */
export async function sendQuickRequestMessage(params: {
  requestNo: string;
  payload: QuickRequestMessageCreatePayload;
}): Promise<QuickRequestMessageCreateResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestMessageCreateResponse>(
    quickRequestPath(params.requestNo, '/messages'),
    { method: 'POST', body: JSON.stringify(params.payload) }
  );
  return res.data;
}

/** PUT …/messages/read — 읽음 위치(greatest) + 그 건 채팅 알림 자동 읽음 (C-21) */
export async function markQuickRequestMessagesRead(params: {
  requestNo: string;
  payload: QuickRequestMarkReadPayload;
}): Promise<QuickRequestMarkReadResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestMarkReadResponse>(
    quickRequestPath(params.requestNo, '/messages/read'),
    { method: 'PUT', body: JSON.stringify(params.payload) }
  );
  return res.data;
}

export async function fetchQuickRequestUnreadTotal(): Promise<number> {
  const res = await apiClientWithMessage<QuickRequestUnreadTotalResponse>(
    `${QUICK_REQUEST_PATH}/unread-total`
  );
  return res.data.total;
}

// ---------------------------------------------------------------------------
// plan 100 — 퀵 대화 AI 답장 추천 (조용한 fallback: abort 외에는 throw하지 않는다)
// ---------------------------------------------------------------------------

function aiSuggestReasonFromStatus(status: number): QuickChatAiErrorReason {
  if (status === 409) return 'stale';
  if (status === 429) return 'limit';
  if (status === 503) return 'disabled';
  return 'failed';
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * POST …/messages/suggest `{ lastMessageId }` — designer §10 ⑤:
 * 2xx 외(409·429·502·503·그 밖)와 네트워크 오류는 `{ source:'rules', reason }`로 돌려준다(React Query 에러 상태 → 재마운트 재요청 방지).
 * `signal`이 abort되면(대화 전환·언마운트) 그대로 throw한다.
 */
export async function suggestQuickChatReplies(
  requestNo: string,
  lastMessageId: number,
  signal?: AbortSignal
): Promise<QuickChatAiSuggestResult> {
  const payload: QuickRequestAiSuggestPayload = { lastMessageId };
  let response: Response;
  try {
    response = await fetch(quickRequestPath(requestNo, '/messages/suggest'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    return { source: 'rules', lastMessageId, reason: 'failed' };
  }

  if (!response.ok) {
    response.body?.cancel().catch(() => undefined);
    return { source: 'rules', lastMessageId, reason: aiSuggestReasonFromStatus(response.status) };
  }

  let body: QuickRequestAiSuggestResponse;
  try {
    body = (await response.json()) as QuickRequestAiSuggestResponse;
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    return { source: 'rules', lastMessageId, reason: 'failed' };
  }

  const data = body?.data;
  if (!data || data.source !== 'ai' || !Array.isArray(data.suggestions) || data.suggestions.length === 0) {
    return { source: 'rules', lastMessageId, reason: 'no_ai' };
  }
  return { source: 'ai', lastMessageId: data.lastMessageId, suggestions: data.suggestions, usage: data.usage };
}

// ---------------------------------------------------------------------------
// plan 101 — 퀵 대화 참여자 (후보 검색 · 초대 · 제외/나가기). 오류 message는 그대로 notifyError
// ---------------------------------------------------------------------------

/** GET …/participants/candidates?q= — 요청자·admin만(403) · 서버가 동방·admin·pending·요청자·본인·참여 중 제외 · ≤20 */
export async function fetchQuickRequestParticipantCandidates(
  requestNo: string,
  q: string
): Promise<QuickRequestParticipantCandidate[]> {
  const params = new URLSearchParams({ q });
  const res = await apiClientWithMessage<QuickRequestParticipantCandidatesResponse>(
    quickRequestPath(requestNo, `/participants/candidates?${params.toString()}`)
  );
  return res.data.candidates;
}

/** POST …/participants `{ userId }` — 201. 400(후보 아님)/403/404/409(이미 참여 중) message는 그대로 표시 */
export async function inviteQuickRequestParticipant(params: {
  requestNo: string;
  userId: string;
}): Promise<QuickRequestParticipantInviteResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestParticipantInviteResponse>(
    quickRequestPath(params.requestNo, '/participants'),
    { method: 'POST', body: JSON.stringify({ userId: params.userId }) }
  );
  return res.data;
}

/** DELETE …/participants/[userId] — 제외·본인 나가기 공용 (응답 `self`로 구분) */
export async function removeQuickRequestParticipant(params: {
  requestNo: string;
  userId: string;
}): Promise<QuickRequestParticipantRemoveResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestParticipantRemoveResponse>(
    quickRequestPath(params.requestNo, `/participants/${encodeURIComponent(params.userId)}`),
    { method: 'DELETE' }
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// plan 98 — 퀵 대화 첨부 (prepare → 브라우저 PUT → messages POST `attachmentIds`)
// ---------------------------------------------------------------------------

function quickChatAttachmentPath(requestNo: string, attachmentId: number, suffix = ''): string {
  return quickRequestPath(requestNo, `/messages/attachments/${attachmentId}${suffix}`);
}

/** POST …/messages/attachments/prepare — 201. 400(형식·용량·30개)/403/404/500 message는 그대로 표시. 순서 = `files` 순서 */
export async function prepareQuickChatAttachments(params: {
  requestNo: string;
  payload: QuickRequestAttachmentPreparePayload;
}): Promise<QuickRequestAttachmentPrepareResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestAttachmentPrepareResponse>(
    quickRequestPath(params.requestNo, '/messages/attachments/prepare'),
    { method: 'POST', body: JSON.stringify(params.payload) }
  );
  return res.data;
}

/** DELETE …/messages/attachments/[id] — pending만 200 · 전송된 첨부 409 · 타인·미존재 404 */
export async function deleteQuickChatAttachment(
  requestNo: string,
  attachmentId: number
): Promise<QuickRequestAttachmentDeleteResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestAttachmentDeleteResponse>(
    quickChatAttachmentPath(requestNo, attachmentId),
    { method: 'DELETE' }
  );
  return res.data;
}

/** GET …/messages/attachments/[id]/url — 서명 URL 60초 (이미지 `<img src>` · lightbox) */
export async function getQuickChatAttachmentUrl(
  requestNo: string,
  attachmentId: number
): Promise<QuickRequestAttachmentUrlResponse['data']> {
  const res = await apiClientWithMessage<QuickRequestAttachmentUrlResponse>(
    quickChatAttachmentPath(requestNo, attachmentId, '/url')
  );
  return res.data;
}

/** `<a href>`용 — Route가 서명 URL(`download=`)로 302 */
export function getQuickChatAttachmentDownloadUrl(requestNo: string, attachmentId: number): string {
  return quickChatAttachmentPath(requestNo, attachmentId, '/download');
}

/** lightbox(`fetch-attachment-blob` `quick-chat` case) — 서명 URL → blob */
export async function downloadQuickChatAttachmentBlob(requestNo: string, attachmentId: number): Promise<Blob> {
  const { url } = await getQuickChatAttachmentUrl(requestNo, attachmentId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('첨부파일을 불러오지 못했습니다.');
  }
  return response.blob();
}
