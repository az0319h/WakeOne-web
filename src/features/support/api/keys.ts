import type { SupportFilters } from './types';

export const supportKeys = {
  all: ['support'] as const,
  lists: () => [...supportKeys.all, 'list'] as const,
  list: (filters: SupportFilters) => [...supportKeys.lists(), filters] as const,
  details: () => [...supportKeys.all, 'detail'] as const,
  detail: (id: number) => [...supportKeys.details(), id] as const,
  comments: (id: number) => [...supportKeys.detail(id), 'comments'] as const
};
