import { notifyError } from '@/lib/notify';
import { QUICK_REQUEST_MESSAGES } from '../schemas/quick-request-workflow';

/** 409 응답 문구 — 상태가 이미 바뀐 요청 (Dialog를 닫고 목록·상세를 다시 읽는다) */
const CONFLICT_MESSAGES: ReadonlySet<string> = new Set([
  QUICK_REQUEST_MESSAGES.stale,
  QUICK_REQUEST_MESSAGES.locked
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
