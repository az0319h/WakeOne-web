import 'server-only';

import { getServiceRoleClient } from '@/lib/supabase/service-role';
import type {
  QuickOpenchatEvent,
  QuickOpenchatStatus,
  QuickRequestStatus
} from '../schemas/quick-request-workflow';
import {
  buildQuickOpenchatText,
  buildQuickRouteSummary,
  type QuickOpenchatTextContext
} from './openchat-message';

/**
 * plan 89 — 오픈채팅 외부 봇 webhook 발송 (D-1 · D-2 · D-3).
 * - env `QUICK_OPENCHAT_WEBHOOK_URL` + `QUICK_OPENCHAT_WEBHOOK_SECRET` (둘 다 있어야 설정됨)
 * - `Authorization: Bearer {secret}` · `X-WakeOne-Event` · `Idempotency-Key: {id}:{event}`
 * - 요청 1건당 최대 2회 시도, 각 4초 timeout. 네트워크 오류·timeout·5xx·408·429일 때만 1회 재시도
 * - 미설정이면 HTTP 호출 없이 `not_configured`로 기록. 발송 실패는 업무(상태 변경)를 막지 않는다
 */

const DISPATCHES_TABLE = 'quick_request_openchat_dispatches';
const ATTEMPT_TIMEOUT_MS = 4_000;
const MAX_ATTEMPTS = 2;
const ERROR_MESSAGE_MAX_LENGTH = 500;
const DEFAULT_APP_URL = 'http://localhost:3000';

export type QuickOpenchatPayload = {
  event: `quick_request.${QuickOpenchatEvent}`;
  requestNo: string;
  status: QuickRequestStatus;
  text: string;
  link: string;
  occurredAt: string;
  requesterName: string;
  route: { from: string; to: string; stopoverCount: number };
  dispatch: null | {
    estimatedAmount: number;
    vehicleInfo: string;
    driverName: string;
    driverPhone: string;
  };
};

export type QuickOpenchatDeliveryResult = {
  status: QuickOpenchatStatus;
  /** 이번 호출에서 시도한 횟수 (미설정이면 0) */
  attempts: number;
  httpStatus: number | null;
  errorMessage: string | null;
};

export type QuickOpenchatOutcome = {
  event: QuickOpenchatEvent;
  status: QuickOpenchatStatus;
  /** 누적 시도 횟수 (기록 기준) */
  attempts: number;
};

type WebhookConfig = { url: string; secret: string };

function readWebhookConfig(): WebhookConfig | null {
  const url = process.env.QUICK_OPENCHAT_WEBHOOK_URL?.trim();
  const secret = process.env.QUICK_OPENCHAT_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return null;
  return { url, secret };
}

/** URL·SECRET이 모두 설정되어 있는지 (대시보드 「오픈채팅 자동 발송: 연결됨/미설정」) */
export function isQuickOpenchatConfigured(): boolean {
  return readWebhookConfig() !== null;
}

function resolveAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;
  return raw.replace(/\/$/, '');
}

export function buildQuickRequestDetailLink(requestNo: string): string {
  return `${resolveAppUrl()}/dashboard/quick/${requestNo}`;
}

function truncateError(message: string): string {
  return message.length > ERROR_MESSAGE_MAX_LENGTH
    ? `${message.slice(0, ERROR_MESSAGE_MAX_LENGTH - 1)}…`
    : message;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

async function postOnce(
  config: WebhookConfig,
  payload: QuickOpenchatPayload,
  idempotencyKey: string
): Promise<{ ok: boolean; retryable: boolean; httpStatus: number | null; error: string | null }> {
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secret}`,
        'Content-Type': 'application/json',
        'X-WakeOne-Event': payload.event,
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      cache: 'no-store'
    });

    // 본문은 쓰지 않지만 연결을 정리한다
    await response.body?.cancel().catch(() => undefined);

    if (response.ok) {
      return { ok: true, retryable: false, httpStatus: response.status, error: null };
    }

    return {
      ok: false,
      retryable: isRetryableStatus(response.status),
      httpStatus: response.status,
      error: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    const message = isTimeout
      ? 'timeout'
      : error instanceof Error
        ? error.message
        : 'network error';
    return { ok: false, retryable: true, httpStatus: null, error: message };
  }
}

/** webhook 호출만 (기록 없음). 미설정이면 호출하지 않는다 */
export async function deliverQuickOpenchatWebhook(
  payload: QuickOpenchatPayload,
  idempotencyKey: string
): Promise<QuickOpenchatDeliveryResult> {
  const config = readWebhookConfig();
  if (!config) {
    return { status: 'not_configured', attempts: 0, httpStatus: null, errorMessage: null };
  }

  let attempts = 0;
  let last: Awaited<ReturnType<typeof postOnce>> | null = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    last = await postOnce(config, payload, idempotencyKey);
    if (last.ok || !last.retryable) break;
  }

  if (last?.ok) {
    return { status: 'sent', attempts, httpStatus: last.httpStatus, errorMessage: null };
  }

  return {
    status: 'failed',
    attempts,
    httpStatus: last?.httpStatus ?? null,
    errorMessage: truncateError(last?.error ?? 'unknown error')
  };
}

export function buildQuickOpenchatIdempotencyKey(
  quickRequestId: string,
  event: QuickOpenchatEvent
): string {
  return `${quickRequestId}:${event}`;
}

/** 발송 대상 퀵 요청 (DB 행에서 필요한 값만) */
export type QuickOpenchatSource = {
  id: string;
  requestNo: string;
  status: QuickRequestStatus;
  requesterName: string;
  origin: { roadAddress?: string; schedule?: { mode: string; datetimeIso?: string } } | null;
  destination: { roadAddress?: string } | null;
  stopovers: unknown;
  dispatch: QuickOpenchatPayload['dispatch'];
};

export function buildQuickOpenchatPayload(
  source: QuickOpenchatSource,
  event: QuickOpenchatEvent,
  extra: { actorName?: string; cancelReason?: string | null } = {}
): QuickOpenchatPayload {
  const link = buildQuickRequestDetailLink(source.requestNo);
  const route = buildQuickRouteSummary(source.origin, source.destination, source.stopovers);
  const context: QuickOpenchatTextContext = {
    requestNo: source.requestNo,
    link,
    requesterName: source.requesterName,
    route,
    originSchedule: source.origin?.schedule ?? null,
    actorName: extra.actorName,
    cancelReason: extra.cancelReason ?? null,
    dispatch: source.dispatch
  };

  return {
    event: `quick_request.${event}`,
    requestNo: source.requestNo,
    status: source.status,
    text: buildQuickOpenchatText(event, context),
    link,
    occurredAt: new Date().toISOString(),
    requesterName: source.requesterName,
    route,
    dispatch: event === 'dispatched' ? source.dispatch : null
  };
}

type DispatchRecordRow = {
  id: number;
  status: QuickOpenchatStatus;
  attempt_count: number;
  payload: QuickOpenchatPayload;
};

async function writeDispatchRecord(params: {
  quickRequestId: string;
  event: QuickOpenchatEvent;
  payload: QuickOpenchatPayload;
  result: QuickOpenchatDeliveryResult;
  previousAttemptCount: number;
}): Promise<number> {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();
  const attemptCount = params.previousAttemptCount + params.result.attempts;

  const { error } = await supabase.from(DISPATCHES_TABLE).upsert(
    {
      quick_request_id: params.quickRequestId,
      event: params.event,
      status: params.result.status,
      attempt_count: attemptCount,
      http_status: params.result.httpStatus,
      error_message: params.result.errorMessage,
      payload: params.payload,
      last_attempt_at: params.result.attempts > 0 ? now : null,
      sent_at: params.result.status === 'sent' ? now : null
    },
    { onConflict: 'quick_request_id,event' }
  );

  if (error) {
    throw new Error(error.message);
  }

  return attemptCount;
}

/**
 * 상태 변경 성공 직후 자동 발송 + 기록. 예외를 던지지 않는다(업무를 막지 않음).
 * 기록 저장까지 실패하면 status는 발송 결과 그대로 돌려주고 콘솔에 남긴다.
 */
export async function dispatchQuickOpenchatEvent(
  source: QuickOpenchatSource,
  event: QuickOpenchatEvent,
  extra: { actorName?: string; cancelReason?: string | null } = {}
): Promise<QuickOpenchatOutcome> {
  let payload: QuickOpenchatPayload;
  try {
    payload = buildQuickOpenchatPayload(source, event, extra);
  } catch (error) {
    console.error('[quick-request/openchat] payload build failed:', error);
    return { event, status: 'failed', attempts: 0 };
  }

  const result = await deliverQuickOpenchatWebhook(
    payload,
    buildQuickOpenchatIdempotencyKey(source.id, event)
  );

  try {
    const attempts = await writeDispatchRecord({
      quickRequestId: source.id,
      event,
      payload,
      result,
      previousAttemptCount: 0
    });
    return { event, status: result.status, attempts };
  } catch (error) {
    console.error('[quick-request/openchat] record write failed:', error);
    return { event, status: result.status, attempts: result.attempts };
  }
}

export type ResendQuickOpenchatResult =
  | { ok: true; outcome: QuickOpenchatOutcome }
  | { ok: false; reason: 'not_found' | 'already_sent' };

/** 저장된 payload를 같은 Idempotency-Key로 다시 보낸다 (같은 재시도 규칙) */
export async function resendQuickOpenchatEvent(
  quickRequestId: string,
  event: QuickOpenchatEvent
): Promise<ResendQuickOpenchatResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from(DISPATCHES_TABLE)
    .select('id, status, attempt_count, payload')
    .eq('quick_request_id', quickRequestId)
    .eq('event', event)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { ok: false, reason: 'not_found' };
  }

  const record = data as DispatchRecordRow;
  if (record.status === 'sent') {
    return { ok: false, reason: 'already_sent' };
  }

  const result = await deliverQuickOpenchatWebhook(
    record.payload,
    buildQuickOpenchatIdempotencyKey(quickRequestId, event)
  );

  if (result.status === 'not_configured') {
    // 미설정: 시도 없음 — 기록 상태만 갱신하지 않고 그대로 둔다
    return {
      ok: true,
      outcome: { event, status: 'not_configured', attempts: record.attempt_count }
    };
  }

  const attempts = await writeDispatchRecord({
    quickRequestId,
    event,
    payload: record.payload,
    result,
    previousAttemptCount: record.attempt_count
  });

  return { ok: true, outcome: { event, status: result.status, attempts } };
}
