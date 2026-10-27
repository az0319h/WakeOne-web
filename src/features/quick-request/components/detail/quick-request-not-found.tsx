import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';

/** 권한 없음·미존재·잘못된 번호 공용 (U-10 · AC-29) */
export function QuickRequestNotFound() {
  return (
    <div className='flex flex-1 items-start justify-center pt-8'>
      <Card
        data-testid='quick-detail-not-found'
        className='flex w-full max-w-md flex-col items-center gap-3 px-6 py-10 text-center shadow-none'
      >
        <Icons.alertCircle aria-hidden className='size-10 text-muted-foreground' />
        <h2 className='text-base font-semibold text-foreground'>퀵 요청을 찾을 수 없습니다.</h2>
        <p className='text-sm text-muted-foreground'>
          요청번호를 확인하거나 목록에서 다시 선택해 주세요.
        </p>
        <Button className='h-11' asChild>
          <Link href='/dashboard/quick'>퀵 대시보드로</Link>
        </Button>
      </Card>
    </div>
  );
}
