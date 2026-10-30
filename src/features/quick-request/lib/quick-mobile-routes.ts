import { isQuickRequestNo } from '../schemas/quick-request-workflow';

/**
 * plan 106 — 퀵 휴대폰 공통 틀(상단바 「뒤로」·breadcrumb·하단 탭)이 쓰는 경로 판정 (순수 함수 · 한 곳).
 */
export const QUICK_LIST_PATH = '/dashboard/quick';
export const QUICK_REQUEST_FORM_PATH = '/dashboard/quick/request';
export const QUICK_CHAT_PATH = '/dashboard/quick/chat';

const QUICK_DETAIL_PATH_PREFIX = `${QUICK_LIST_PATH}/`;

function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `/dashboard/quick/{번호}` → 번호 · 번호 형식이 아니거나 더 깊은 경로면 null */
export function parseQuickDetailRequestNo(pathname: string): string | null {
  if (!pathname.startsWith(QUICK_DETAIL_PATH_PREFIX)) return null;
  const segment = pathname.slice(QUICK_DETAIL_PATH_PREFIX.length);
  if (!segment || segment.includes('/')) return null;
  const requestNo = safeDecodePathSegment(segment);
  return isQuickRequestNo(requestNo) ? requestNo : null;
}

/** 하위 화면(요청 폼·상세) — 상단바 「뒤로」가 붙고 하단 탭은 없다 (D-4) */
export function isQuickSubPagePath(pathname: string): boolean {
  return pathname === QUICK_REQUEST_FORM_PATH || parseQuickDetailRequestNo(pathname) !== null;
}

/** 탭 화면(내역·대화 목록) — 하단 탭이 보인다 (대화방 `?request=`는 호출부에서 따로 뺀다) */
export function isQuickTabPagePath(pathname: string): boolean {
  return pathname === QUICK_LIST_PATH || pathname === QUICK_CHAT_PATH;
}
