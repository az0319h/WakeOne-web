/**
 * 문서함 URL 상태 (nuqs) — 서버 page(prefetch)와 클라이언트 툴바가 같은 parser·정규화를 쓴다.
 * `nuqs/server` parser는 server-only가 아니라 공유 가능하다.
 */
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral
} from 'nuqs/server';
import {
  WORKFLOW_SCOPES,
  WORKFLOW_SORTS,
  WORKFLOW_TABS,
  type WorkflowGroup,
  type WorkflowScope,
  type WorkflowSort,
  type WorkflowTab
} from '../api/types';

export const WORKFLOW_ARRAY_SEPARATOR = ',';

export const workflowSearchParsers = {
  tab: parseAsStringLiteral(WORKFLOW_TABS).withDefault('in_progress'),
  scope: parseAsStringLiteral(WORKFLOW_SCOPES).withDefault('related'),
  q: parseAsString,
  writer: parseAsArrayOf(parseAsString, WORKFLOW_ARRAY_SEPARATOR),
  template: parseAsArrayOf(parseAsString, WORKFLOW_ARRAY_SEPARATOR),
  updated: parseAsString,
  sort: parseAsStringLiteral(WORKFLOW_SORTS).withDefault('updated_desc'),
  doc: parseAsString
};

/** 목록 query key·요청에 쓰는 정규화된 필터 (tab 포함) */
export type WorkflowListFilters = {
  tab: WorkflowTab;
  scope: WorkflowScope;
  q: string | null;
  writer: string[];
  template: string[];
  updated: string | null;
  sort: WorkflowSort;
};

/** 건수 query는 tab·sort와 무관 */
export type WorkflowCountFilters = Omit<WorkflowListFilters, 'tab' | 'sort'>;

export type WorkflowListRequest = WorkflowListFilters & {
  group: WorkflowGroup | null;
  limit: number;
};

export const WORKFLOW_GROUP_LIMIT: Record<WorkflowGroup, number> = {
  approval_required: 5,
  in_progress: 20
};
export const WORKFLOW_PAGE_LIMIT = 20;

type RawParams = {
  tab: WorkflowTab;
  scope: WorkflowScope;
  q: string | null;
  writer: string[] | null;
  template: string[] | null;
  updated: string | null;
  sort: WorkflowSort;
};

export function buildWorkflowListRequest(
  filters: WorkflowListFilters,
  group: WorkflowGroup | null
): WorkflowListRequest {
  return {
    ...filters,
    group,
    limit: group ? WORKFLOW_GROUP_LIMIT[group] : WORKFLOW_PAGE_LIMIT
  };
}

/** URL 값 → 정규화 필터. 비관리자가 `scope=company`를 넣으면 `related`로 바꾼다 */
export function normalizeWorkflowListFilters(
  raw: RawParams,
  options: { isWorkflowAdmin: boolean }
): WorkflowListFilters {
  const q = raw.q?.trim() ?? '';
  return {
    tab: raw.tab,
    scope: raw.scope === 'company' && !options.isWorkflowAdmin ? 'related' : raw.scope,
    q: q ? q : null,
    writer: [...new Set((raw.writer ?? []).filter(Boolean))],
    template: [...new Set((raw.template ?? []).filter(Boolean))],
    updated: raw.updated?.trim() ? raw.updated.trim() : null,
    sort: raw.sort
  };
}

export function toWorkflowCountFilters(filters: WorkflowListFilters): WorkflowCountFilters {
  return {
    scope: filters.scope,
    q: filters.q,
    writer: filters.writer,
    template: filters.template,
    updated: filters.updated
  };
}

export function hasActiveWorkflowFilters(filters: WorkflowListFilters): boolean {
  return Boolean(
    filters.q ||
      filters.writer.length ||
      filters.template.length ||
      filters.updated ||
      filters.sort !== 'updated_desc' ||
      filters.scope !== 'related'
  );
}

/** API query string (`/api/workflow/documents?…`) */
export function toWorkflowListSearchParams(
  filters: Partial<WorkflowListRequest> & WorkflowCountFilters,
  extra: { cursor?: string | null; exclude?: string | null } = {}
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab) params.set('tab', filters.tab);
  params.set('scope', filters.scope);
  if (filters.group) params.set('group', filters.group);
  if (filters.q) params.set('q', filters.q);
  if (filters.writer.length) params.set('writer', filters.writer.join(','));
  if (filters.template.length) params.set('template', filters.template.join(','));
  if (filters.updated) params.set('updated', filters.updated);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (extra.cursor) params.set('cursor', extra.cursor);
  if (extra.exclude) params.set('exclude', extra.exclude);
  return params;
}
