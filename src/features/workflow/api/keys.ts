import type {
  WorkflowCountFilters,
  WorkflowListRequest
} from '../lib/search-params';

export const workflowKeys = {
  all: ['workflow'] as const,
  lists: () => [...workflowKeys.all, 'list'] as const,
  list: (request: WorkflowListRequest) => [...workflowKeys.lists(), request] as const,
  counts: (filters: WorkflowCountFilters) => [...workflowKeys.all, 'counts', filters] as const,
  details: () => [...workflowKeys.all, 'detail'] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
  referenceSearch: (q: string, exclude: string | null) =>
    [...workflowKeys.all, 'reference-search', q, exclude] as const,
  templates: () => [...workflowKeys.all, 'templates'] as const,
  template: (templateKey: string) => [...workflowKeys.templates(), templateKey] as const,
  drafts: () => [...workflowKeys.all, 'drafts'] as const,
  draft: (id: string) => [...workflowKeys.drafts(), id] as const,
  members: () => [...workflowKeys.all, 'members'] as const,
  admins: () => [...workflowKeys.all, 'admins'] as const
};
