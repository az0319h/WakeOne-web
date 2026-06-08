import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BirthdayCelebrantsBannerSkeleton() {
  return (
    <div className='col-span-4 md:col-span-3'>
      <Card className='relative overflow-hidden'>
        <CardContent className='mx-auto max-w-2xl p-0'>
          <div className='px-6 py-8 text-center sm:px-10 sm:py-10'>
            <Skeleton className='mx-auto mb-5 h-6 w-20 rounded-full' />
            <Skeleton className='mx-auto mb-5 size-20 rounded-full sm:size-24' />
            <Skeleton className='mx-auto h-8 w-56 max-w-full' />
            <Skeleton className='mx-auto mt-3 h-4 w-64 max-w-full' />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
