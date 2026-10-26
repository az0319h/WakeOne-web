'use client';

import { useMemo } from 'react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import type { QuickRequestListFilters, QuickRequestStatus } from '../../api/types';
import {
  isQuickRequestStatus,
  QUICK_REQUEST_LIST_DEFAULT_LIMIT
} from '../../schemas/quick-request-workflow';

export const QUICK_DASHBOARD_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

const quickDashboardParsers = {
  status: parseAsString,
  search: parseAsString,
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(QUICK_REQUEST_LIST_DEFAULT_LIMIT)
};

export type QuickDashboardFilters = {
  /** 허용값 밖은 null(전체) */
  status: QuickRequestStatus | null;
  search: string | null;
  page: number;
  perPage: number;
};

/** 대시보드 URL 상태 (status·search·page·perPage) — nuqs shallow */
export function useQuickDashboardParams() {
  const [params, setParams] = useQueryStates(quickDashboardParsers, {
    shallow: true,
    throttleMs: 50
  });

  const filters = useMemo<QuickDashboardFilters>(
    () => ({
      status: isQuickRequestStatus(params.status) ? params.status : null,
      search: params.search?.trim() ? params.search.trim() : null,
      page: Math.max(1, params.page),
      perPage: params.perPage > 0 ? params.perPage : QUICK_REQUEST_LIST_DEFAULT_LIMIT
    }),
    [params.page, params.perPage, params.search, params.status]
  );

  /** 상태·검색이 바뀌면 page를 1로 되돌린다 (AC-31) */
  const setStatus = (status: QuickRequestStatus | null) =>
    void setParams({ status, page: null });
  const setSearch = (search: string | null) => void setParams({ search, page: null });
  const resetFilters = () => void setParams({ status: null, search: null, page: null });

  return { filters, setStatus, setSearch, resetFilters };
}

export function toQuickRequestListFilters(filters: QuickDashboardFilters): QuickRequestListFilters {
  return {
    status: filters.status,
    search: filters.search,
    page: filters.page,
    limit: filters.perPage
  };
}

export function hasActiveQuickDashboardFilters(filters: QuickDashboardFilters): boolean {
  return filters.status !== null || filters.search !== null;
}
