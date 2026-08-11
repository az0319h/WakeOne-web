import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function WalletSummaryOverviewCardSkeleton() {
  return (
    <Card aria-hidden data-testid='wallet-summary-overview-skeleton'>
      <CardHeader className='flex flex-row items-start justify-between gap-4 pb-2'>
        <div className='space-y-2'>
          <Skeleton className='h-6 w-32' />
          <Skeleton className='h-4 w-full max-w-xs' />
        </div>
        <Skeleton className='size-9 shrink-0 rounded-md' />
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-9 w-40' />
          <Skeleton className='h-4 w-56 max-w-full' />
        </div>
        <div className='space-y-1.5'>
          <Skeleton className='h-2 w-full rounded-full' />
          <div className='flex items-center justify-between'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-3 w-24' />
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-2 border-t pt-4'>
          <Skeleton className='h-4 w-48 max-w-full' />
          <Skeleton className='ml-auto h-5 w-20 rounded-full' />
        </div>
        <Skeleton className='h-4 w-14' />
      </CardContent>
    </Card>
  );
}
