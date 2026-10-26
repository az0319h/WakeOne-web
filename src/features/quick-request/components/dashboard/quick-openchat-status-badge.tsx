import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type QuickOpenchatStatusBadgeProps = {
  configured: boolean;
};

/** 대시보드 상단 「오픈채팅 자동 발송: 연결됨/미설정」 (동방·admin만 · AC-35) */
export function QuickOpenchatStatusBadge({ configured }: QuickOpenchatStatusBadgeProps) {
  return (
    <Badge
      variant='outline'
      data-testid='quick-openchat-status'
      data-configured={configured}
      className='h-7 gap-1.5 rounded-full px-2.5 text-xs font-normal'
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          configured ? 'bg-primary' : 'bg-muted-foreground'
        )}
      />
      {configured ? '오픈채팅 자동 발송: 연결됨' : '오픈채팅 자동 발송: 미설정'}
    </Badge>
  );
}
