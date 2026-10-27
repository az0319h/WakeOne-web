import { queryOptions } from '@tanstack/react-query';
import { fetchPushPreferences } from './push-service';

export const pushKeys = {
  all: ['push-notifications'] as const,
  preferences: () => [...pushKeys.all, 'preferences'] as const
};

/** GET /api/notifications/push/preferences — configured·disabled_groups·devices·groups */
export function pushPreferencesQueryOptions() {
  return queryOptions({
    queryKey: pushKeys.preferences(),
    queryFn: fetchPushPreferences
  });
}
