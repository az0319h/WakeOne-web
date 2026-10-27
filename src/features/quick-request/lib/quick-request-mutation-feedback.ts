import { notifyError, notifyWarning } from '@/lib/notify';
import type { QuickOpenchatStatus } from '../schemas/quick-request-workflow';
import { QUICK_REQUEST_MESSAGES } from '../schemas/quick-request-workflow';

/** 409 응답 문구 — 상태가 이미 바뀐 요청 (Dialog를 닫고 목록·상세를 다시 읽는다) */
const CONFLICT_MESSAGES: ReadonlySet<string> = new Set([
  QUICK_REQUEST_MESSAGES.stale,
  QUICK_REQUEST_MESSAGES.locked,
  QUICK_REQUEST_MESSAGES.openchatAlreadySent
]);

export function getQuickRequestErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : QUICK_REQUEST_MESSAGES.internalError;
}

export function isQuickRequestConflictError(error: unknown): boolean {
  return error instanceof Error && CONFLICT_MESSAGES.has(error.message);
}

/** 실패 토스트 · 409면 `true` (호출부가 Dialog를 닫는다) */
export function notifyQuickRequestError(error: unknown): boolean {
  notifyError(getQuickRequestErrorMessage(error));
  return isQuickRequestConflictError(error);
}

/**
 * 오픈채팅 자동 발송 실패 경고 (업무는 성공 → error 토스트 대신 warning).
 * `not_configured`는 토스트 없음.
 */
export function notifyQuickOpenchatOutcome(
  openchat: { status: QuickOpenchatStatus } | undefined | null
) {
  if (openchat?.status === 'failed') {
    notifyWarning(QUICK_REQUEST_MESSAGES.openchatFailedWarning);
  }
}
