/**
 * plan 100 D-3 — AI 답장 추천 결과 후처리 (순수 함수 · 단위 테스트 대상).
 * - 문장마다: trim · 이모지/따옴표/번호 매기기 제거 · 공백 정리 · 가림 표시(`[연락처]` 등) 포함 문장 제거
 *   · 숫자 7자리 이상(구분자 `-` `.` `,` 공백 허용 · 전화·금액 방지) 포함 문장 제거 · 40자 클립
 * - 중복 제거(공백·문장부호 무시) → 앞에서 4개 → 부족분은 규칙 칩(역할별 → 공통 문구)으로 채워 항상 4개
 * - `aiCount` = 살아남은 AI 문장 수 (0이면 호출부가 source `rules`)
 * 이 파일은 path alias(`@/…`)·런타임 상대 import를 쓰지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

export const AI_SANITIZE_DEFAULT_COUNT = 4;
export const AI_SANITIZE_DEFAULT_MAX_LENGTH = 40;

/** 숫자 7개 이상이 구분자(- . , 공백)로만 이어진 경우 */
const LONG_NUMBER_PATTERN = /\d(?:[-.,\s]?\d){6,}/;
/** 모델이 프롬프트의 가림 표시를 문장에 옮겨 쓴 경우 (보내면 어색하므로 제거) */
const MASK_TOKEN_PATTERN = /\[(?:연락처|주소|이메일|이름)\]/;
/** 이모지·변형 선택자·ZWJ·키캡 */
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\u{FE0F}|\u{FE0E}|\u{200D}|\u{20E3}/gu;
/** 따옴표·꺾쇠 (문장 안팎 모두 제거) */
const QUOTE_PATTERN = /["'“”‘’「」『』《》〈〉`]/g;
/** 앞쪽 번호·글머리표: `1. ` `2) ` `- ` `• ` `* ` `① ` */
const LIST_MARKER_PATTERN = /^(?:\d{1,2}[.)](?!\d)\s*|[-•*·]\s*|[①-⑳]\s*)/;

function clipChars(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  return chars.slice(0, maxLength).join('').trimEnd();
}

/** 문장 1개 정리 → 쓸 수 없으면 null */
export function sanitizeSuggestionText(
  raw: unknown,
  maxLength: number = AI_SANITIZE_DEFAULT_MAX_LENGTH
): string | null {
  if (typeof raw !== 'string') return null;

  let text = raw.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(EMOJI_PATTERN, '');
  text = text.replace(QUOTE_PATTERN, '');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(LIST_MARKER_PATTERN, '').trim();

  if (!text) return null;
  if (MASK_TOKEN_PATTERN.test(text)) return null;
  if (LONG_NUMBER_PATTERN.test(text)) return null;

  const clipped = clipChars(text, maxLength);
  return clipped || null;
}

/** 중복 판정 키 — 공백·문장부호·물결 무시 */
export function suggestionDedupeKey(text: string): string {
  return text.replace(/[\s.,!?~…·]/g, '').toLowerCase();
}

export type SanitizedSuggestions = {
  /** 항상 `count`개 (fallback이 모자라면 그보다 적을 수 있음) */
  suggestions: string[];
  /** 살아남은 AI 문장 수 (앞쪽부터) */
  aiCount: number;
};

/**
 * AI 문장 배열 → 정리·중복 제거 → 앞에서 `count`개 → 부족분 fallback.
 * `raw`가 배열이 아니면 AI 문장 0개로 본다.
 */
export function sanitizeSuggestions(
  raw: unknown,
  options: { fallback: readonly string[]; count?: number; maxLength?: number }
): SanitizedSuggestions {
  const count = Math.max(1, options.count ?? AI_SANITIZE_DEFAULT_COUNT);
  const maxLength = Math.max(1, options.maxLength ?? AI_SANITIZE_DEFAULT_MAX_LENGTH);
  const seen = new Set<string>();
  const suggestions: string[] = [];

  const items = Array.isArray(raw) ? raw : [];
  for (const item of items) {
    if (suggestions.length >= count) break;
    const text = sanitizeSuggestionText(item, maxLength);
    if (!text) continue;
    const key = suggestionDedupeKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    suggestions.push(text);
  }

  const aiCount = suggestions.length;

  for (const reply of options.fallback) {
    if (suggestions.length >= count) break;
    const text = reply.trim();
    const key = suggestionDedupeKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    suggestions.push(text);
  }

  return { suggestions, aiCount };
}

/**
 * 모델 응답 텍스트(JSON `{ suggestions: string[] }`) → 문장 배열. 형식이 다르면 null (호출부 = 파싱 실패).
 * 구조화 출력이 형식을 보장하지만 refusal·max_tokens로 잘린 경우를 대비한다.
 */
export function parseSuggestionsJson(text: string): unknown[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = (parsed as { suggestions?: unknown }).suggestions;
  return Array.isArray(value) ? value : null;
}
