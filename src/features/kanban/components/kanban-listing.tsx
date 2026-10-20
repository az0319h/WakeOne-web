import { unstable_noStore as noStore } from 'next/cache';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getSessionProfile } from '@/features/auth/api/session.server';
import {
  listGoogleTasklists,
  listGoogleTasks
} from '@/features/google-tasks/api/service.server';
import {
  googleTasklistsQueryOptions,
  googleTasksQueryOptions
} from '@/features/google-tasks/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { KanbanPageContent } from './kanban-page-content';

export async function KanbanListing() {
  noStore();
  const profile = await getSessionProfile();
  if (!profile) {
    return null;
  }

  const googleEmail = profile.google_email?.trim() || profile.email;
  const queryClient = getQueryClient();
  const tasklistsResponse = await queryClient.fetchQuery({
    ...googleTasklistsQueryOptions(),
    queryFn: async () => {
      const { tasklists } = await listGoogleTasklists(profile.user_id, googleEmail);
      return {
        success: true,
        message: '목록을 불러왔습니다.',
        tasklists
      };
    }
  });
  await Promise.all(
    tasklistsResponse.tasklists.map((tasklist) =>
      queryClient.prefetchQuery({
        ...googleTasksQueryOptions(tasklist.id, true),
        queryFn: async () => {
          const { tasks } = await listGoogleTasks(
            profile.user_id,
            googleEmail,
            tasklist.id,
            true
          );
          return {
            success: true,
            message: '할 일을 불러왔습니다.',
            tasks
          };
        }
      })
    )
  );

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <KanbanPageContent />
      </HydrationBoundary>
    </div>
  );
}
