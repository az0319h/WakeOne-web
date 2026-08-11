import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function AnnouncementOverviewRowSkeleton() {
  return (
    <div className='space-y-2 rounded-md border p-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Skeleton className='h-4 w-[140px]' />
        <Skeleton className='h-5 w-10 rounded-full' />
        <Skeleton className='h-5 w-12 rounded-full' />
      </div>
      <Skeleton className='h-3 w-[220px] max-w-full' />
      <Skeleton className='h-3 w-36' />
    </div>
  );
}

export function AnnouncementsOverviewSkeleton() {
  return (
    <Card aria-hidden data-testid='announcements-overview-skeleton'>
      <CardHeader className='flex flex-row items-start justify-between gap-4 pb-2'>
        <div className='space-y-2'>
          <Skeleton className='h-6 w-24' />
          <Skeleton className='h-4 w-48' />
        </div>
        <Skeleton className='h-4 w-16 shrink-0' />
      </CardHeader>
      <CardContent className='space-y-2'>
        <AnnouncementOverviewRowSkeleton />
        <AnnouncementOverviewRowSkeleton />
        <AnnouncementOverviewRowSkeleton />
      </CardContent>
    </Card>
  );
}
