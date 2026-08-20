import {
  SUPPORT_STATUSES,
  type SupportFilters,
  type SupportStatus
} from './types';

export const SUPPORT_STATUS_FILTER_OPTIONS: {
  value: SupportStatus;
  label: string;
}[] = [
  { value: 'pending', label: '접수대기' },
  { value: 'received', label: '접수됨' },
  { value: 'completed', label: '처리완료' }
];

function parseStatusCsv(value: string | null | undefined): SupportStatus[] {
  if (!value) {
    return [];
  }

  const unique = new Set<SupportStatus>();
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (SUPPORT_STATUSES.includes(trimmed as SupportStatus)) {
      unique.add(trimmed as SupportStatus);
    }
  }

  return [...unique];
}

function normalizeStatusInput(
  value: string | null | readonly string[] | undefined
): SupportStatus[] {
  if (!value) {
    return [];
  }
  if (typeof value === 'string') {
    return parseStatusCsv(value);
  }

  const unique = new Set<SupportStatus>();
  for (const part of value) {
    const trimmed = part.trim();
    if (SUPPORT_STATUSES.includes(trimmed as SupportStatus)) {
      unique.add(trimmed as SupportStatus);
    }
  }
  return [...unique];
}

export function buildSupportFilters(input: {
  limit?: number;
  cursor?: string;
  search?: string | null;
  status?: string | null | readonly string[];
  submitted_by?: string | null;
}): SupportFilters {
  const search = input.search?.trim() || undefined;
  const status = normalizeStatusInput(input.status);
  const submittedBy = input.submitted_by?.trim() || undefined;

  return {
    ...(input.limit !== undefined && { limit: input.limit }),
    ...(input.cursor && { cursor: input.cursor }),
    ...(search && { search }),
    ...(status.length > 0 && { status }),
    ...(submittedBy && { submitted_by: submittedBy })
  };
}

export function hasActiveSupportFilters(filters: SupportFilters): boolean {
  return Boolean(
    filters.search?.trim() ||
      (filters.status?.length ?? 0) > 0 ||
      filters.submitted_by?.trim()
  );
}

export function serializeSupportFiltersToSearchParams(
  filters: SupportFilters
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.limit) {
    params.set('limit', String(filters.limit));
  }
  if (filters.cursor) {
    params.set('cursor', filters.cursor);
  }
  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }
  if (filters.status?.length) {
    params.set('status', filters.status.join(','));
  }
  if (filters.submitted_by?.trim()) {
    params.set('submitted_by', filters.submitted_by.trim());
  }
  return params;
}
