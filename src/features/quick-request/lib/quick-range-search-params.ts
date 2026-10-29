import { parseAsString, parseAsStringLiteral } from 'nuqs';
import type { QuickRequestRangeFilters } from '../api/types';
import {
  isQuickRangeDate,
  QUICK_RANGE_DEFAULT_KIND,
  QUICK_RANGE_KINDS,
  type QuickRangeKind
} from './quick-request-range';

/**
 * plan 97 D-1 — 퀵 조회 기간 nuqs parsers (대시보드·「퀵 대화」 params 훅이 spread).
 * URL: `range` ∈ 7d·30d·90d·all·custom (기본 7d는 생략) · `from`·`to`는 custom일 때만 `yyyy-MM-dd`.
 */
export const quickRangeParsers = {
  range: parseAsStringLiteral(QUICK_RANGE_KINDS),
  from: parseAsString,
  to: parseAsString
};

export type QuickRangeParams = {
  range: QuickRangeKind | null;
  from: string | null;
  to: string | null;
};

/** 정규화된 기간 필터 — `range`는 항상 있고, `from`/`to`는 custom일 때만 값이 있다 (쿼리 키 안정화) */
export type QuickRangeValue = {
  range: QuickRangeKind;
  from: string | null;
  to: string | null;
};

export const QUICK_RANGE_DEFAULT_VALUE: QuickRangeValue = {
  range: QUICK_RANGE_DEFAULT_KIND,
  from: null,
  to: null
};

/**
 * URL 값 → 정규화. `range` 없음·불량 → 7d. `custom`인데 `from`/`to`가 불량이거나 `from > to`면 7d로 정정.
 * 프리셋·all이면 `from`/`to`를 버린다.
 */
export function normalizeQuickRangeParams(params: Partial<QuickRangeParams>): QuickRangeValue {
  const range = params.range ?? QUICK_RANGE_DEFAULT_KIND;
  if (range !== 'custom') {
    return { range, from: null, to: null };
  }
  const from = params.from ?? null;
  const to = params.to ?? null;
  if (!isQuickRangeDate(from) || !isQuickRangeDate(to) || from > to) {
    return QUICK_RANGE_DEFAULT_VALUE;
  }
  return { range: 'custom', from, to };
}

/** 정규화 값 → nuqs setParams 인자 (기본 7d는 null로 지워 URL에 남기지 않는다) */
export function toQuickRangeParams(value: QuickRangeValue): QuickRangeParams {
  if (value.range === 'custom') {
    return { range: 'custom', from: value.from, to: value.to };
  }
  return {
    range: value.range === QUICK_RANGE_DEFAULT_KIND ? null : value.range,
    from: null,
    to: null
  };
}

/** API 필터 형태 (`QuickRequestRangeFilters`) — `appendQuickRangeSearchParams`가 쓴다 */
export function toQuickRangeFilters(value: QuickRangeValue): QuickRequestRangeFilters {
  return { range: value.range, from: value.from, to: value.to };
}
