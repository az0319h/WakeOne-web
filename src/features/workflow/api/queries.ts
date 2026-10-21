import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type {
  WorkflowCountFilters,
  WorkflowListRequest
} from '../lib/search-params';
import { workflowKeys } from './keys';
import {
  fetchWorkflowAdmins,
  fetchWorkflowAttachmentDownload,
  fetchWorkflowCounts,
  fetchWorkflowDocument,
  fetchWorkflowDocuments,
  fetchWorkflowDraft,
  fetchWorkflowDrafts,
  fetchWorkflowMembers,
  fetchWorkflowTemplate,
  fetchWorkflowTemplates,
  isWorkflowApiError,
  type WorkflowListPage
} from './service';

export { workflowKeys };

/** 4xx(404·403 등)는 재시도하지 않는다 */
function retryUnlessClientError(failureCount: number, error: unknown) {
  if (isWorkflowApiError(error) && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export function workflowListInfiniteQueryOptions(request: WorkflowListRequest) {
  return infiniteQueryOptions({
    queryKey: workflowKeys.list(request),
    queryFn: ({ pageParam }) => fetchWorkflowDocuments(request, { cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: WorkflowListPage) => lastPage.next_cursor ?? undefined,
    retry: retryUnlessClientError
  });
}

export function workflowCountsQueryOptions(filters: WorkflowCountFilters) {
  return queryOptions({
    queryKey: workflowKeys.counts(filters),
    queryFn: () => fetchWorkflowCounts(filters),
    retry: retryUnlessClientError
  });
}

export function workflowDocumentQueryOptions(id: string) {
  return queryOptions({
    queryKey: workflowKeys.detail(id),
    queryFn: () => fetchWorkflowDocument(id),
    retry: retryUnlessClientError,
    staleTime: 0
  });
}

/** 참조문서 선택 — 내가 열람할 수 있는 문서(전체 탭) 검색 */
export function workflowReferenceSearchQueryOptions(q: string, exclude: string | null) {
  return queryOptions({
    queryKey: workflowKeys.referenceSearch(q, exclude),
    queryFn: () =>
      fetchWorkflowDocuments(
        {
          tab: 'all',
          scope: 'related',
          q: q || null,
          writer: [],
          template: [],
          updated: null,
          sort: 'updated_desc',
          group: null,
          limit: 20
        },
        { exclude }
      ),
    retry: retryUnlessClientError
  });
}

export function workflowTemplatesQueryOptions() {
  return queryOptions({
    queryKey: workflowKeys.templates(),
    queryFn: fetchWorkflowTemplates,
    staleTime: 5 * 60 * 1000
  });
}

export function workflowTemplateQueryOptions(templateKey: string) {
  return queryOptions({
    queryKey: workflowKeys.template(templateKey),
    queryFn: () => fetchWorkflowTemplate(templateKey),
    retry: retryUnlessClientError,
    staleTime: 0
  });
}

export function workflowDraftsQueryOptions() {
  return queryOptions({
    queryKey: workflowKeys.drafts(),
    queryFn: fetchWorkflowDrafts,
    staleTime: 0
  });
}

export function workflowDraftQueryOptions(id: string) {
  return queryOptions({
    queryKey: workflowKeys.draft(id),
    queryFn: () => fetchWorkflowDraft(id),
    retry: retryUnlessClientError,
    staleTime: 0
  });
}

export function workflowMembersQueryOptions() {
  return queryOptions({
    queryKey: workflowKeys.members(),
    queryFn: fetchWorkflowMembers,
    staleTime: 5 * 60 * 1000
  });
}

export function workflowAdminsQueryOptions() {
  return queryOptions({
    queryKey: workflowKeys.admins(),
    queryFn: fetchWorkflowAdmins
  });
}

/** 첨부 다운로드용 60초 signed URL — 매번 새로 받는다 (`queryClient.fetchQuery`) */
export function workflowAttachmentDownloadQueryOptions(documentId: string, attachmentId: string) {
  return queryOptions({
    queryKey: [...workflowKeys.detail(documentId), 'attachment-download', attachmentId] as const,
    queryFn: () => fetchWorkflowAttachmentDownload(documentId, attachmentId, { download: true }),
    staleTime: 0,
    gcTime: 0,
    retry: false
  });
}
