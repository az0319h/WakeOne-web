'use client';

import { useCallback, useMemo } from 'react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import {
  ASSET_DEFAULT_PER_PAGE,
  ASSET_PER_PAGE_OPTIONS,
  ASSET_SCOPES,
  type AssetScope
} from '../api/types';
import {
  ASSET_REQUEST_STATUS_FILTERS,
  type AssetRequestStatusFilter,
  type AssetTargetType
} from '@/features/asset-requests/api/types';

/**
 * plan 103 · designer §12 — 구독·비품 화면 URL 상태(nuqs · shallow).
 * - `status` 없음 = 기본 묶음 · 쉼표 목록 = 그대로 · `all` = 상태 조건 없음 (designer C-17)
 * - 탭·범위·상태·카드·검색·전환이 바뀌면 page=1
 */

const NUQS_OPTIONS = { shallow: true, history: 'replace', scroll: false, throttleMs: 50 } as const;

export type LedgerView = 'list' | 'requests';

export function normalizePerPage(perPage: number): number {
  return (ASSET_PER_PAGE_OPTIONS as readonly number[]).includes(perPage)
    ? perPage
    : ASSET_DEFAULT_PER_PAGE;
}

/** 「목록 | 요청」 전환 (`view`) */
export function useLedgerView() {
  const [params, setParams] = useQueryStates(
    { view: parseAsString, page: parseAsInteger },
    NUQS_OPTIONS
  );
  const view: LedgerView = params.view === 'requests' ? 'requests' : 'list';
  const setView = useCallback(
    (next: LedgerView) =>
      void setParams({ view: next === 'requests' ? 'requests' : null, page: null }),
    [setParams]
  );
  return { view, setView };
}

const listParsers = {
  category: parseAsString,
  kind: parseAsString,
  scope: parseAsString,
  status: parseAsString,
  card: parseAsString,
  q: parseAsString,
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(ASSET_DEFAULT_PER_PAGE)
};

export type LedgerStatusMode = 'default' | 'all' | 'custom';

export type LedgerListState<TTab extends string, TStatus extends string> = {
  tab: TTab | 'all';
  scope: AssetScope;
  statusMode: LedgerStatusMode;
  /** 화면에 체크로 보일 상태 (기본이면 기본 묶음 · all이면 전부) */
  statuses: TStatus[];
  card: string | null;
  q: string | null;
  page: number;
  perPage: number;
  /** 「초기화」 활성 · 빈 상태 「필터 초기화」 — 탭·전환은 제외 */
  hasActiveFilters: boolean;
};

type LedgerListConfig<TTab extends string, TStatus extends string> = {
  tabKey: 'category' | 'kind';
  tabValues: readonly TTab[];
  statuses: readonly TStatus[];
  defaultStatuses: readonly TStatus[];
};

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/** 목록 필터 상태 + setter (구독 `category` · 비품 `kind`) */
export function useLedgerListParams<TTab extends string, TStatus extends string>(
  config: LedgerListConfig<TTab, TStatus>
) {
  const { tabKey, tabValues, statuses: allStatuses, defaultStatuses } = config;
  const [params, setParams] = useQueryStates(listParsers, NUQS_OPTIONS);

  const rawTab = params[tabKey];
  const rawStatus = params.status;

  const state = useMemo<LedgerListState<TTab, TStatus>>(() => {
    const tab =
      rawTab && (tabValues as readonly string[]).includes(rawTab) ? (rawTab as TTab) : 'all';
    const scope = (ASSET_SCOPES as readonly string[]).includes(params.scope ?? '')
      ? (params.scope as AssetScope)
      : 'all';

    let statusMode: LedgerStatusMode = 'default';
    let statuses: TStatus[] = [...defaultStatuses];
    if (rawStatus === 'all') {
      statusMode = 'all';
      statuses = [...allStatuses];
    } else if (rawStatus) {
      const picked = rawStatus
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is TStatus => (allStatuses as readonly string[]).includes(value));
      if (picked.length > 0) {
        statusMode = 'custom';
        statuses = allStatuses.filter((status) => picked.includes(status));
      }
    }

    const card = params.card && /^[0-9]{4}$/.test(params.card) ? params.card : null;
    const q = params.q?.trim() ? params.q.trim() : null;
    const page = Math.max(1, params.page);
    const perPage = normalizePerPage(params.perPage);
    const hasActiveFilters =
      q !== null || scope !== 'all' || statusMode !== 'default' || card !== null;

    return { tab, scope, statusMode, statuses, card, q, page, perPage, hasActiveFilters };
  }, [
    rawTab,
    rawStatus,
    params.scope,
    params.card,
    params.q,
    params.page,
    params.perPage,
    tabValues,
    allStatuses,
    defaultStatuses
  ]);

  const setTab = useCallback(
    (next: string) => {
      const value = next !== 'all' && (tabValues as readonly string[]).includes(next) ? next : null;
      void setParams(
        tabKey === 'category' ? { category: value, page: null } : { kind: value, page: null }
      );
    },
    [setParams, tabKey, tabValues]
  );

  const setScope = useCallback(
    (next: AssetScope) => void setParams({ scope: next === 'all' ? null : next, page: null }),
    [setParams]
  );

  const setStatuses = useCallback(
    (next: readonly string[]) => {
      const ordered = allStatuses.filter((status) => next.includes(status));
      let value: string | null;
      if (ordered.length === 0 || ordered.length === allStatuses.length) {
        value = 'all';
      } else if (sameSet(ordered, defaultStatuses)) {
        value = null;
      } else {
        value = ordered.join(',');
      }
      void setParams({ status: value, page: null });
    },
    [allStatuses, defaultStatuses, setParams]
  );

  const resetStatuses = useCallback(
    () => void setParams({ status: null, page: null }),
    [setParams]
  );

  const setCard = useCallback(
    (next: string | null) => void setParams({ card: next, page: null }),
    [setParams]
  );

  const setQuery = useCallback(
    (next: string | null) =>
      void setParams({ q: next && next.trim() ? next.trim() : null, page: null }),
    [setParams]
  );

  const setPage = useCallback(
    (next: number) => void setParams({ page: next <= 1 ? null : next }),
    [setParams]
  );

  const setPerPage = useCallback(
    (next: number) =>
      void setParams({
        perPage: next === ASSET_DEFAULT_PER_PAGE ? null : normalizePerPage(next),
        page: null
      }),
    [setParams]
  );

  /** 탭·전환은 유지하고 q·scope·status·card·page만 지운다 (designer §2-3) */
  const resetFilters = useCallback(
    () => void setParams({ q: null, scope: null, status: null, card: null, page: null }),
    [setParams]
  );

  return {
    state,
    setTab,
    setScope,
    setStatuses,
    resetStatuses,
    setCard,
    setQuery,
    setPage,
    setPerPage,
    resetFilters
  };
}

export type LedgerListParams<TTab extends string, TStatus extends string> = ReturnType<
  typeof useLedgerListParams<TTab, TStatus>
>;

const dialogParsers = {
  subscription: parseAsInteger,
  equipment: parseAsInteger,
  request: parseAsInteger,
  compose: parseAsString
};

export type LedgerDialogScreen = 'row' | 'compose' | 'request';

/**
 * 가운데 Dialog 화면 (designer §2-5)
 * `?equipment={id}` 행 · `&compose=1` 요청 폼 · `&request={rid}` 요청 1건(행 없이 열면 요청 표·알림에서 온 것)
 */
export function useLedgerDialogParams(targetType: AssetTargetType) {
  const rowKey = targetType === 'subscription' ? 'subscription' : 'equipment';
  const [params, setParams] = useQueryStates(dialogParsers, NUQS_OPTIONS);

  const rawRowId = params[rowKey];
  const rowId = rawRowId !== null && rawRowId > 0 ? rawRowId : null;
  const requestId = params.request && params.request > 0 ? params.request : null;
  const compose = params.compose === '1' && rowId !== null;
  const screen: LedgerDialogScreen | null =
    requestId !== null ? 'request' : rowId !== null ? (compose ? 'compose' : 'row') : null;

  /** 행 파라미터만 바꾸는 패치 (`subscription` | `equipment`) */
  const rowPatch = useCallback(
    (id: number | null) => (rowKey === 'subscription' ? { subscription: id } : { equipment: id }),
    [rowKey]
  );

  const openRow = useCallback(
    (id: number) => void setParams({ ...rowPatch(id), request: null, compose: null }),
    [rowPatch, setParams]
  );
  const openCompose = useCallback(() => void setParams({ compose: '1', request: null }), [setParams]);
  const closeCompose = useCallback(() => void setParams({ compose: null }), [setParams]);
  /** 행 화면 「이 장비의 요청」 → 요청 화면 (행 파라미터 유지 = 뒤로 「N-012 장비로」) */
  const openRequestFromRow = useCallback(
    (id: number) => void setParams({ request: id, compose: null }),
    [setParams]
  );
  /** 요청 표 → 요청 화면 (행 파라미터 없음 = 뒤로 「장비 정보 보기」) */
  const openRequest = useCallback(
    (id: number) => void setParams({ ...rowPatch(null), request: id, compose: null }),
    [rowPatch, setParams]
  );
  const backToRow = useCallback(() => void setParams({ request: null }), [setParams]);
  const openTargetRow = useCallback(
    (id: number) => void setParams({ ...rowPatch(id), request: null, compose: null }),
    [rowPatch, setParams]
  );
  const close = useCallback(
    () => void setParams({ ...rowPatch(null), request: null, compose: null }),
    [rowPatch, setParams]
  );

  return {
    rowId,
    requestId,
    screen,
    openRow,
    openCompose,
    closeCompose,
    openRequestFromRow,
    openRequest,
    backToRow,
    openTargetRow,
    close
  };
}

const requestListParsers = {
  rstatus: parseAsString,
  mine_assigned: parseAsString,
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(ASSET_DEFAULT_PER_PAGE)
};

/** 요청 화면(`view=requests`) — 상태 칩 `rstatus` · 「내 담당만」 `mine_assigned` · page */
export function useLedgerRequestListParams() {
  const [params, setParams] = useQueryStates(requestListParsers, NUQS_OPTIONS);

  const status: AssetRequestStatusFilter = (
    ASSET_REQUEST_STATUS_FILTERS as readonly string[]
  ).includes(params.rstatus ?? '')
    ? (params.rstatus as AssetRequestStatusFilter)
    : 'open';
  const mineAssigned = params.mine_assigned === '1';
  const page = Math.max(1, params.page);
  const perPage = normalizePerPage(params.perPage);

  const setStatus = useCallback(
    (next: AssetRequestStatusFilter) =>
      void setParams({ rstatus: next === 'open' ? null : next, page: null }),
    [setParams]
  );
  const setMineAssigned = useCallback(
    (next: boolean) => void setParams({ mine_assigned: next ? '1' : null, page: null }),
    [setParams]
  );
  const setPage = useCallback(
    (next: number) => void setParams({ page: next <= 1 ? null : next }),
    [setParams]
  );
  const setPerPage = useCallback(
    (next: number) =>
      void setParams({
        perPage: next === ASSET_DEFAULT_PER_PAGE ? null : normalizePerPage(next),
        page: null
      }),
    [setParams]
  );

  return { status, mineAssigned, page, perPage, setStatus, setMineAssigned, setPage, setPerPage };
}
