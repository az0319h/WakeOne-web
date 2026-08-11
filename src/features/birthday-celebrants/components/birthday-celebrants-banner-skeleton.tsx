import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BirthdayCelebrantsBannerSkeleton() {
  return (
    <Card className='relative overflow-hidden' aria-hidden data-testid='birthday-celebrants-skeleton'>
      <CardContent className='w-full p-0'>
        <div className='flex flex-col items-center px-6 py-8 text-center sm:px-10 sm:py-10'>
          <Skeleton className='mb-5 h-5 w-28 rounded-full' />
          <Skeleton className='mb-5 size-20 rounded-full sm:size-24' />
          <Skeleton className='h-7 w-56 max-w-full' />
          <Skeleton className='mt-3 h-4 w-64 max-w-full' />
        </div>
      </CardContent>
    </Card>
  );
}
