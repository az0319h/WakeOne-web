import { queryOptions } from '@tanstack/react-query';
import { fetchGoogleTasks, fetchGoogleTasklists } from './service';
import { googleTasksKeys } from './types';

export { googleTasksKeys };

const GOOGLE_TASKS_STALE_MS = 0;

export function googleTasklistsQueryOptions() {
  return queryOptions({
    queryKey: googleTasksKeys.tasklists(),
    queryFn: () => fetchGoogleTasklists(),
    staleTime: GOOGLE_TASKS_STALE_MS,
    refetchOnMount: 'always'
  });
}

export function googleTasksQueryOptions(tasklistId: string, showCompleted = true) {
  return queryOptions({
    queryKey: [...googleTasksKeys.tasks(tasklistId), { showCompleted }] as const,
    queryFn: () => fetchGoogleTasks(tasklistId, showCompleted),
    staleTime: GOOGLE_TASKS_STALE_MS,
    refetchOnMount: 'always'
  });
}
