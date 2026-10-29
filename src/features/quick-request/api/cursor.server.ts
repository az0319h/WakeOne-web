import 'server-only';

/**
 * plan 97 D-5 · D-9 — opaque 커서 (base64url(JSON)). FE는 값을 해석하지 않고 그대로 되돌려 보낸다.
 * 디코딩 실패·형식 불일치는 null → Route가 400 「요청 형식이 올바르지 않습니다.」
 */

const CURSOR_MAX_LENGTH = 512;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeCursorObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || raw.length > CURSOR_MAX_LENGTH || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function isCursorTimestamp(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

// ---------------------------------------------------------------------------
// 「퀵 대화」 목록 — 정렬 키 (has_message desc, sort_at desc, id desc)
// ---------------------------------------------------------------------------

export type QuickConversationCursor = {
  hasMessage: boolean;
  sortAt: string;
  requestId: string;
};

export function encodeConversationCursor(cursor: QuickConversationCursor): string {
  return encodeCursor({ h: cursor.hasMessage, at: cursor.sortAt, id: cursor.requestId });
}

export function decodeConversationCursor(raw: string | null | undefined): QuickConversationCursor | null {
  const object = decodeCursorObject(raw);
  if (!object) return null;
  const { h, at, id } = object;
  if (typeof h !== 'boolean' || !isCursorTimestamp(at) || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    return null;
  }
  return { hasMessage: h, sortAt: at, requestId: id };
}

// ---------------------------------------------------------------------------
// 최근 주소 — 정렬 키 (last_used_at desc, id desc)
// ---------------------------------------------------------------------------

export type QuickRecentAddressCursor = {
  lastUsedAt: string;
  id: number;
};

export function encodeRecentAddressCursor(cursor: QuickRecentAddressCursor): string {
  return encodeCursor({ at: cursor.lastUsedAt, id: cursor.id });
}

export function decodeRecentAddressCursor(raw: string | null | undefined): QuickRecentAddressCursor | null {
  const object = decodeCursorObject(raw);
  if (!object) return null;
  const { at, id } = object;
  if (!isCursorTimestamp(at) || typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return { lastUsedAt: at, id };
}
