import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { getOfficeSnackSessionDetail as getOfficeSnackSessionDetailServer } from '../api/service.server';
import { officeSnackSessionDetailQueryOptions } from '../api/queries';
import { OfficeSnackDetailClient } from './office-snack-detail-client';

interface OfficeSnackDetailProps {
  sessionId: number;
  userId: string;
}

export default function OfficeSnackDetail({ sessionId, userId }: OfficeSnackDetailProps) {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery({
    ...officeSnackSessionDetailQueryOptions(sessionId),
    queryFn: async () => {
      const detail = await getOfficeSnackSessionDetailServer({
        sessionId,
        userId
      });
      if (!detail) {
        throw new Error('회차를 찾을 수 없습니다.');
      }
      return detail;
    }
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OfficeSnackDetailClient sessionId={sessionId} />
    </HydrationBoundary>
  );
}
