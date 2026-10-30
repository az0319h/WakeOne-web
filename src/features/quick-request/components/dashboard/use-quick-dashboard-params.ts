'use client';

import { useCallback, useMemo } from 'react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import type { QuickRequestListInfiniteFilters } from '../../api/queries';
import type { QuickRequestListFilters, QuickRequestRangeFilters, QuickRequestStatus } from '../../api/types';
import {
  normalizeQuickRangeParams,
  QUICK_RANGE_DEFAULT_VALUE,
  quickRangeParsers,
  toQuickRangeFilters,
  toQuickRangeParams,
  type QuickRangeValue
} from '../../lib/quick-range-search-params';
import type { QuickRangeKind } from '../../lib/quick-request-range';
import {
  isQuickRequestStatus,
  QUICK_REQUEST_LIST_DEFAULT_LIMIT,
  QUICK_REQUEST_LIST_PAGE_SIZES
} from '../../schemas/quick-request-workflow';

/** plan 97 D-2 — 10 · 20 · 50 (`DataTablePagination pageSizeOptions`) */
export const QUICK_DASHBOARD_PAGE_SIZE_OPTIONS: number[] = [...QUICK_REQUEST_LIST_PAGE_SIZES];

const quickDashboardParsers = {
  ...quickRangeParsers,
  status: parseAsString,
  search: parseAsString,
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(QUICK_REQUEST_LIST_DEFAULT_LIMIT)
};

export type QuickDashboardFilters = {
  /** plan 97 D-1 — 정규화된 기간 (`range`는 항상 · `from`/`to`는 custom일 때만) */
  range: QuickRangeKind;
  from: string | null;
  to: string | null;
  /** 허용값 밖은 null(전체) */
  status: QuickRequestStatus | null;
  search: string | null;
  page: number;
  /** 10 · 20 · 50 — 옵션 밖은 20 */
  perPage: number;
};

function normalizePerPage(perPage: number): number {
  return (QUICK_REQUEST_LIST_PAGE_SIZES as readonly number[]).includes(perPage)
    ? perPage
    : QUICK_REQUEST_LIST_DEFAULT_LIMIT;
}

/** 대시보드 URL 상태 (range·from·to·status·search·page·perPage) — nuqs shallow */
export function useQuickDashboardParams() {
  const [params, setParams] = useQueryStates(quickDashboardParsers, {
    shallow: true,
    throttleMs: 50
  });

  const filters = useMemo<QuickDashboardFilters>(() => {
    const range = normalizeQuickRangeParams(params);
    return {
      range: range.range,
      from: range.from,
      to: range.to,
      status: isQuickRequestStatus(params.status) ? params.status : null,
      search: params.search?.trim() ? params.search.trim() : null,
      page: Math.max(1, params.page),
      perPage: normalizePerPage(params.perPage)
    };
  }, [params]);

  /** 기간·상태·검색이 바뀌면 page를 1로 되돌린다 (plan 89 AC-31 · plan 97 D-2) */
  const setStatus = useCallback(
    (status: QuickRequestStatus | null) => void setParams({ status, page: null }),
    [setParams]
  );
  const setSearch = useCallback(
    (search: string | null) => void setParams({ search, page: null }),
    [setParams]
  );
  const setRange = useCallback(
    (next: QuickRangeValue) => void setParams({ ...toQuickRangeParams(next), page: null }),
    [setParams]
  );
  /** 상태·검색만 초기화 · 기간은 조회 컨텍스트라 유지 (designer K3) */
  const resetFilters = useCallback(
    () => void setParams({ status: null, search: null, page: null }),
    [setParams]
  );

  return { filters, setStatus, setSearch, setRange, resetFilters };
}

export function toQuickRequestListFilters(filters: QuickDashboardFilters): QuickRequestListFilters {
  return {
    range: filters.range,
    from: filters.from,
    to: filters.to,
    status: filters.status,
    search: filters.search,
    page: filters.page,
    limit: filters.perPage
  };
}

/** plan 106 D-9 — 휴대폰 무한 목록 키·조회용 (URL `page`/`perPage` 무시) */
export function toQuickRequestListInfiniteFilters(
  filters: QuickDashboardFilters
): QuickRequestListInfiniteFilters {
  return {
    range: filters.range,
    from: filters.from,
    to: filters.to,
    status: filters.status,
    search: filters.search
  };
}

/**
 * plan 106 designer §3.6 — 휴대폰 「필터」 버튼 배지 숫자.
 * (기간 ≠ 기본 7일 ? 1 : 0) + (상태 있음 ? 1 : 0) · 검색은 판 밖에 보이므로 세지 않는다 (AC-15 「2」→「1」).
 */
export function countQuickDashboardSheetFilters(filters: QuickDashboardFilters): number {
  return (filters.range !== QUICK_RANGE_DEFAULT_VALUE.range ? 1 : 0) + (filters.status !== null ? 1 : 0);
}

/** 카드·메타바(summary) 쿼리 키용 — 기간만 */
export function toQuickDashboardRangeFilters(filters: QuickDashboardFilters): QuickRequestRangeFilters {
  return toQuickRangeFilters(filters);
}

export function toQuickDashboardRangeValue(filters: QuickDashboardFilters): QuickRangeValue {
  return { range: filters.range, from: filters.from, to: filters.to };
}

/** 「초기화」 활성 · 「조건에 맞는」 빈 상태 — 기간은 제외 (designer K3 · 기간은 조회 컨텍스트라 초기화가 되돌리지 않는다) */
export function hasActiveQuickDashboardFilters(filters: QuickDashboardFilters): boolean {
  return filters.status !== null || filters.search !== null;
}

/** 0건 빈 상태 종류 — `filtered` 검색·상태 · `period` 기간(「전체」 아님) · `initial` 전체 기간 0건 */
export type QuickDashboardEmptyReason = 'filtered' | 'period' | 'initial';

/** 검색·상태가 우선 · 그다음 기간 · 「첫 퀵 요청」은 기간 「전체」 + 필터 없음일 때만 (mobile-ux 2차 A#6) */
export function getQuickDashboardEmptyReason(filters: QuickDashboardFilters): QuickDashboardEmptyReason {
  if (hasActiveQuickDashboardFilters(filters)) return 'filtered';
  return filters.range === 'all' ? 'initial' : 'period';
}
