import { apiClientWithMessage } from '@/lib/api-client';
import type {
  CreatePushSubscriptionPayload,
  CreatePushSubscriptionResponse,
  DeletePushSubscriptionPayload,
  DeletePushSubscriptionResponse,
  DetachPushSubscriptionPayload,
  DetachPushSubscriptionResponse,
  PushPreferencesResponse,
  PushTestSendResponse,
  UpdatePushPreferencesPayload,
  UpdatePushPreferencesResponse
} from './push-types';

type ApiEnvelope<T> = { success: true; data: T } | { success: false; message?: string };

function unwrap<T>(response: ApiEnvelope<T>): T {
  if (!response.success) {
    throw new Error(response.message ?? '요청에 실패했습니다.');
  }
  return response.data;
}

const PREFERENCES_ENDPOINT = '/notifications/push/preferences';
const TEST_ENDPOINT = '/notifications/push/test';
/** 구독 API는 상태 코드가 필요해 `apiClientWithMessage` 대신 `requestPushApi`(직접 fetch)를 쓴다 */
const SUBSCRIPTIONS_URL = '/api/notifications/push/subscriptions';
const DETACH_URL = '/api/notifications/push/subscriptions/detach';

/**
 * plan 105 — 상태 코드를 알아야 하는 구독 API 오류(409·503·404 구분).
 * `message`는 기존 `apiClientWithMessage`와 같다(서버 message 또는 `API error: {status}`) → 91 호출부 문자열 판정 그대로 동작.
 * 네트워크 오류·abort는 이 클래스가 아니라 fetch의 TypeError/DOMException이 그대로 던져진다.
 */
export class PushApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PushApiError';
    this.status = status;
  }
}

export function isPushApiError(error: unknown, status?: number): error is PushApiError {
  return error instanceof PushApiError && (status === undefined || error.status === status);
}

/** JSON 요청 → `{success, data}` 언랩 · 실패는 `PushApiError(status)` */
async function requestPushApi<T>(
  url: string,
  init: { method: 'POST' | 'DELETE'; body?: unknown; signal?: AbortSignal }
): Promise<{ data: T; status: number }> {
  const res = await fetch(url, {
    method: init.method,
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'include',
    signal: init.signal
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload || !payload.success) {
    const message =
      payload && !payload.success && payload.message ? String(payload.message) : `API error: ${res.status}`;
    throw new PushApiError(message, res.status);
  }

  return { data: payload.data, status: res.status };
}

export async function fetchPushPreferences(): Promise<PushPreferencesResponse> {
  const response = await apiClientWithMessage<ApiEnvelope<PushPreferencesResponse>>(
    PREFERENCES_ENDPOINT
  );
  return unwrap(response);
}

export async function updatePushPreferences(
  payload: UpdatePushPreferencesPayload
): Promise<UpdatePushPreferencesResponse> {
  const response = await apiClientWithMessage<ApiEnvelope<UpdatePushPreferencesResponse>>(
    PREFERENCES_ENDPOINT,
    { method: 'PUT', body: JSON.stringify(payload) }
  );
  return unwrap(response);
}

/**
 * POST subscriptions — 201 신규 · 200 기존.
 * 실패: `PushApiError` (`status` 400 · 409(plan 105 auto_resume 2종) · 503 · 500 …) · 네트워크는 fetch 오류 그대로.
 */
export async function createPushSubscription(
  payload: CreatePushSubscriptionPayload
): Promise<CreatePushSubscriptionResponse> {
  const { data } = await createPushSubscriptionWithStatus(payload);
  return data;
}

/** plan 105 — 자동 복구가 201/200을 구분할 때 (`status` 포함) */
export async function createPushSubscriptionWithStatus(
  payload: CreatePushSubscriptionPayload
): Promise<{ data: CreatePushSubscriptionResponse; status: number }> {
  return requestPushApi<CreatePushSubscriptionResponse>(SUBSCRIPTIONS_URL, {
    method: 'POST',
    body: payload
  });
}

/**
 * DELETE subscriptions — 200 · 실패 `PushApiError` (404 = 내 행 아님 · 400 · 500).
 * `signal`: 로그아웃 2초 timeout용(선택).
 */
export async function deletePushSubscription(
  payload: DeletePushSubscriptionPayload,
  options?: { signal?: AbortSignal }
): Promise<DeletePushSubscriptionResponse> {
  const { data } = await requestPushApi<DeletePushSubscriptionResponse>(SUBSCRIPTIONS_URL, {
    method: 'DELETE',
    body: payload,
    signal: options?.signal
  });
  return data;
}

/** plan 105 — POST subscriptions/detach · 200 `{result}` · 실패 `PushApiError` (400 · 401 · 500) */
export async function detachPushSubscription(
  payload: DetachPushSubscriptionPayload
): Promise<DetachPushSubscriptionResponse> {
  const { data } = await requestPushApi<DetachPushSubscriptionResponse>(DETACH_URL, {
    method: 'POST',
    body: payload
  });
  return data;
}

export async function sendPushTest(): Promise<PushTestSendResponse> {
  const response = await apiClientWithMessage<ApiEnvelope<PushTestSendResponse>>(TEST_ENDPOINT, {
    method: 'POST'
  });
  return unwrap(response);
}
