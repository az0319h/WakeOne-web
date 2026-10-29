import * as z from 'zod';

/**
 * plan 99 — 퀵 주소 「장소 검색」(외부 장소 키워드 검색 프록시) 공용 상수·스키마 (Route Handler · FE 공용).
 * 이 파일은 path alias(`@/…`)를 import하지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

/** 검색어 최대 길이 (trim 후) */
export const QUICK_PLACE_QUERY_MAX_LENGTH = 50;
/** 1회 응답 건수 (외부 API size 상한) */
export const QUICK_PLACE_PAGE_SIZE = 15;
/** 요청 가능한 최대 page (15 × 3 = 45건) */
export const QUICK_PLACE_MAX_PAGE = 3;
/** 사용자당 분당 Route 호출 상한 (D-5) */
export const QUICK_PLACE_RATE_LIMIT_PER_MINUTE = 30;
/** 외부 호출 timeout (D-2) */
export const QUICK_PLACE_FETCH_TIMEOUT_MS = 4_000;

/** 서버 응답 문구 (FE는 `message`를 그대로 표시) */
export const QUICK_PLACE_MESSAGES = {
  /** 400 — q 빈값(trim 후) */
  queryRequired: '검색어를 입력해 주세요.',
  /** 400 — q 50자 초과 */
  queryTooLong: '검색어는 50자 이내로 입력해 주세요.',
  /** 400 — page가 1~3 정수가 아님 */
  invalidRequest: '요청 형식이 올바르지 않습니다.',
  /** 429 — 사용자당 분당 30회 초과 */
  rateLimited: '잠시 후 다시 시도해 주세요.',
  /** 502 — 외부 API 4xx/5xx·429·timeout·응답 형식 오류 */
  upstreamFailed: '장소 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  /** 503 — 키 미설정 */
  notConfigured: '장소 검색이 아직 설정되지 않았습니다.'
} as const;

/** GET `?q=&page=` — q는 trim 후 1~50자 · page는 생략 시 1, 아니면 1~3 정수 문자열 */
export const quickPlaceSearchParamsSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, QUICK_PLACE_MESSAGES.queryRequired)
    .max(QUICK_PLACE_QUERY_MAX_LENGTH, QUICK_PLACE_MESSAGES.queryTooLong),
  page: z
    .string()
    .regex(/^[1-3]$/, QUICK_PLACE_MESSAGES.invalidRequest)
    .optional()
    .transform((value) => (value ? Number(value) : 1))
});

export type QuickPlaceSearchParams = z.infer<typeof quickPlaceSearchParamsSchema>;

/** URLSearchParams → 검증 결과. 실패 시 첫 issue 문구 */
export function parseQuickPlaceSearchParams(
  searchParams: URLSearchParams
): { ok: true; data: QuickPlaceSearchParams } | { ok: false; message: string } {
  const page = searchParams.get('page');
  const parsed = quickPlaceSearchParamsSchema.safeParse({
    q: searchParams.get('q') ?? '',
    page: page === null ? undefined : page
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? QUICK_PLACE_MESSAGES.invalidRequest };
  }
  return { ok: true, data: parsed.data };
}
