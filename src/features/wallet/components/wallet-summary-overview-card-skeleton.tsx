import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function WalletSummaryOverviewCardSkeleton() {
  return (
    <Card aria-hidden>
      <CardHeader className='space-y-2 pb-2'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-4 w-full max-w-xs' />
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-9 w-40' />
          <Skeleton className='h-4 w-56 max-w-full' />
        </div>
        <Skeleton className='h-2 w-full rounded-full' />
        <div className='flex items-center justify-between border-t pt-4'>
          <Skeleton className='h-4 w-48 max-w-full' />
          <Skeleton className='h-5 w-20 rounded-full' />
        </div>
        <Skeleton className='h-4 w-14' />
      </CardContent>
    </Card>
  );
}
