import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AnnouncementsOverviewSkeleton() {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <Skeleton className='h-5 w-24' />
        <Skeleton className='mt-2 h-4 w-48' />
      </CardHeader>
      <CardContent className='space-y-2'>
        <Skeleton className='h-16 w-full rounded-md' />
        <Skeleton className='h-16 w-full rounded-md' />
        <Skeleton className='h-16 w-full rounded-md' />
      </CardContent>
    </Card>
  );
}
