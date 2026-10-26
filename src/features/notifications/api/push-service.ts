import { apiClientWithMessage } from '@/lib/api-client';
import type {
  CreatePushSubscriptionPayload,
  CreatePushSubscriptionResponse,
  DeletePushSubscriptionPayload,
  DeletePushSubscriptionResponse,
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
const SUBSCRIPTIONS_ENDPOINT = '/notifications/push/subscriptions';
const TEST_ENDPOINT = '/notifications/push/test';

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

export async function createPushSubscription(
  payload: CreatePushSubscriptionPayload
): Promise<CreatePushSubscriptionResponse> {
  const response = await apiClientWithMessage<ApiEnvelope<CreatePushSubscriptionResponse>>(
    SUBSCRIPTIONS_ENDPOINT,
    { method: 'POST', body: JSON.stringify(payload) }
  );
  return unwrap(response);
}

export async function deletePushSubscription(
  payload: DeletePushSubscriptionPayload
): Promise<DeletePushSubscriptionResponse> {
  const response = await apiClientWithMessage<ApiEnvelope<DeletePushSubscriptionResponse>>(
    SUBSCRIPTIONS_ENDPOINT,
    { method: 'DELETE', body: JSON.stringify(payload) }
  );
  return unwrap(response);
}

export async function sendPushTest(): Promise<PushTestSendResponse> {
  const response = await apiClientWithMessage<ApiEnvelope<PushTestSendResponse>>(TEST_ENDPOINT, {
    method: 'POST'
  });
  return unwrap(response);
}
