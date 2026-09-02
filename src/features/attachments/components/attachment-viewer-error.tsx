import Link from 'next/link';
import { Button } from '@/components/ui/button';

type AttachmentViewerErrorProps = {
  message: string;
};

export function AttachmentViewerError({ message }: AttachmentViewerErrorProps) {
  return (
    <div className='flex h-dvh w-full flex-col items-center justify-center gap-4 px-6 text-center'>
      <p className='text-muted-foreground text-sm'>{message}</p>
      <Button asChild variant='outline'>
        <Link href='/dashboard/overview'>대시보드로 돌아가기</Link>
      </Button>
    </div>
  );
}
