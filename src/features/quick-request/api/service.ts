import { apiClientWithMessage } from '@/lib/api-client';
import type {
  QuickRequestLocation,
  QuickRequestNote,
  QuickRequestNoteCreateResponse,
  QuickRequestNoteDeleteResponse,
  QuickRequestNoteMutationPayload,
  QuickRequestNoteUpdateResponse,
  QuickRequestNotesListResponse,
  QuickRequestNotifyPayload,
  QuickRequestNotifyResponse,
  QuickRequestRecentAddress,
  QuickRequestRecentAddressesListResponse,
  QuickRequestRecentAddressesRecordResponse
} from './types';

export type NotifyQuickRequestResult = QuickRequestNotifyResponse & {
  httpStatus: number;
};

export async function notifyQuickRequest(
  payload: QuickRequestNotifyPayload
): Promise<NotifyQuickRequestResult> {
  const response = await fetch('/api/quick-request/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as QuickRequestNotifyResponse;

  return {
    success: data.success ?? false,
    message: data.message ?? '퀵 요청 전송에 실패했습니다.',
    redirectUrl: data.redirectUrl,
    httpStatus: response.status
  };
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

export async function recordQuickRequestRecentAddresses(
  locations: QuickRequestLocation[]
): Promise<number> {
  const res = await apiClientWithMessage<QuickRequestRecentAddressesRecordResponse>(
    RECENT_ADDRESSES_PATH,
    { method: 'POST', body: JSON.stringify({ locations }) }
  );
  return res.data.count;
}
