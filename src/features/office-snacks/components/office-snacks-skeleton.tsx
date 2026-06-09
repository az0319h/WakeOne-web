import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function OfficeSnacksPageSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='bg-muted flex h-10 w-full animate-pulse justify-start gap-1 rounded-xl p-1'>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className='bg-background/60 h-full w-16 shrink-0 rounded-lg' />
        ))}
      </div>
      <Card className='overflow-hidden py-0'>
        <div className='divide-y'>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className='flex items-center gap-3 px-4 py-3'>
              <div className='bg-muted h-10 w-10 shrink-0 animate-pulse rounded-full' />
              <div className='flex-1 space-y-2'>
                <div className='bg-muted h-4 w-40 animate-pulse rounded' />
                <div className='bg-muted h-3 w-56 animate-pulse rounded' />
              </div>
              <div className='space-y-2 text-right'>
                <div className='bg-muted ml-auto h-3 w-16 animate-pulse rounded' />
                <div className='bg-muted ml-auto h-5 w-14 animate-pulse rounded-full' />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function OfficeSnackDetailSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Card>
        <CardHeader>
          <div className='bg-muted h-6 w-60 animate-pulse rounded' />
          <div className='bg-muted h-4 w-72 animate-pulse rounded' />
        </CardHeader>
        <CardContent className='grid gap-3 md:grid-cols-2'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className='bg-muted h-10 animate-pulse rounded' />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className='bg-muted h-5 w-44 animate-pulse rounded' />
        </CardHeader>
        <CardContent className='space-y-3'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className='bg-muted h-24 animate-pulse rounded-lg' />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
