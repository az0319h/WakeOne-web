import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function LiveUsersCardSkeleton() {
  return (
    <Card className='h-fit w-full self-start'>
      <CardHeader>
        <Skeleton className='h-6 w-[100px]' />
        <Skeleton className='h-4 w-[160px]' />
      </CardHeader>
      <CardContent>
        <div className='space-y-8'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex min-h-11 items-center'>
              <Skeleton className='h-9 w-9 rounded-full' />
              <div className='ml-4 space-y-1'>
                <Skeleton className='h-4 w-[120px]' />
                <Skeleton className='h-4 w-[160px]' />
              </div>
              <Skeleton className='ml-auto h-5 w-[56px] rounded-full' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
