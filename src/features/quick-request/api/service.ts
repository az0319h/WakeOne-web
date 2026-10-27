import { apiClientWithMessage } from '@/lib/api-client';
import type {
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
  QuickRequestRecentAddress,
  QuickRequestRecentAddressesListResponse
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

export async function fetchQuickRequestSummary(): Promise<QuickRequestSummary> {
  const res = await apiClientWithMessage<QuickRequestSummaryResponse>(
    `${QUICK_REQUEST_PATH}/summary`
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

export async function fetchQuickRequestRecentAddresses(): Promise<QuickRequestRecentAddress[]> {
  const res =
    await apiClientWithMessage<QuickRequestRecentAddressesListResponse>(RECENT_ADDRESSES_PATH);
  return res.data.addresses;
}
