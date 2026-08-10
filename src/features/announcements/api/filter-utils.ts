import {
  ANNOUNCEMENT_PRIORITIES,
  type AnnouncementPriority,
  type AnnouncementsFilters
} from './types';

export const ANNOUNCEMENT_PRIORITY_FILTER_OPTIONS: {
  value: AnnouncementPriority;
  label: string;
}[] = [
  { value: 'normal', label: '일반' },
  { value: 'important', label: '중요' },
  { value: 'urgent', label: '긴급' }
];

function parsePriorityCsv(value: string | null | undefined): AnnouncementPriority[] {
  if (!value) {
    return [];
  }

  const unique = new Set<AnnouncementPriority>();
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (ANNOUNCEMENT_PRIORITIES.includes(trimmed as AnnouncementPriority)) {
      unique.add(trimmed as AnnouncementPriority);
    }
  }

  return [...unique];
}

export function parseAnnouncementPinnedParam(
  value: string | null | undefined
): boolean | undefined {
  if (value === '1' || value === 'true') {
    return true;
  }
  return undefined;
}

function normalizePriorityInput(
  value: string | null | readonly string[] | undefined
): AnnouncementPriority[] {
  if (!value) {
    return [];
  }
  if (typeof value === 'string') {
    return parsePriorityCsv(value);
  }
  const unique = new Set<AnnouncementPriority>();
  for (const part of value) {
    const trimmed = part.trim();
    if (ANNOUNCEMENT_PRIORITIES.includes(trimmed as AnnouncementPriority)) {
      unique.add(trimmed as AnnouncementPriority);
    }
  }
  return [...unique];
}

export function buildAnnouncementsFilters(input: {
  limit?: number;
  cursor?: string;
  search?: string | null;
  priority?: string | null | readonly string[];
  pinned?: string | null | boolean;
}): AnnouncementsFilters {
  const search = input.search?.trim() || undefined;
  const priority = normalizePriorityInput(input.priority);
  const pinned =
    typeof input.pinned === 'string'
      ? parseAnnouncementPinnedParam(input.pinned)
      : input.pinned === true
        ? true
        : undefined;

  return {
    ...(input.limit !== undefined && { limit: input.limit }),
    ...(input.cursor && { cursor: input.cursor }),
    ...(search && { search }),
    ...(priority.length > 0 && { priority }),
    ...(pinned && { pinned })
  };
}

export function hasActiveAnnouncementFilters(filters: AnnouncementsFilters): boolean {
  return Boolean(
    filters.search?.trim() ||
      (filters.priority?.length ?? 0) > 0 ||
      filters.pinned === true
  );
}

export function serializeAnnouncementFiltersToSearchParams(
  filters: AnnouncementsFilters
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
  if (filters.priority?.length) {
    params.set('priority', filters.priority.join(','));
  }
  if (filters.pinned) {
    params.set('pinned', '1');
  }
  return params;
}
