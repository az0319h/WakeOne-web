'use client';

import { useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import {
  normalizeWorkflowListFilters,
  workflowSearchParsers
} from '../lib/search-params';

/** 문서함 URL 상태 (tab·scope·q·writer·template·updated·sort·doc) — shallow */
export function useWorkflowListParams(isWorkflowAdmin: boolean) {
  const [params, setParams] = useQueryStates(workflowSearchParsers, {
    shallow: true,
    throttleMs: 50
  });

  const filters = useMemo(
    () =>
      normalizeWorkflowListFilters(
        {
          tab: params.tab,
          scope: params.scope,
          q: params.q,
          writer: params.writer,
          template: params.template,
          updated: params.updated,
          sort: params.sort
        },
        { isWorkflowAdmin }
      ),
    [
      params.tab,
      params.scope,
      params.q,
      params.writer,
      params.template,
      params.updated,
      params.sort,
      isWorkflowAdmin
    ]
  );

  return { params, setParams, filters };
}

/** 상세 패널 `?doc=` 만 다루는 가벼운 훅 */
export function useWorkflowDocParam() {
  const [{ doc }, setParams] = useQueryStates(
    { doc: workflowSearchParsers.doc },
    { shallow: true }
  );
  return {
    doc,
    setDoc: (next: string | null) => setParams({ doc: next })
  };
}
