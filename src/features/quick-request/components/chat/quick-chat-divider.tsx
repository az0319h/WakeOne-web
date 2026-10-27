import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type QuickChatDividerProps = {
  label: string;
  /** `primary` = 「여기부터 새 메시지」 (C-13) */
  tone?: 'muted' | 'primary';
  'data-testid'?: string;
};

/** 날짜·안 읽음 구분선 공용 — `Separator` 2개 + 가운데 텍스트 (U-5 · U-13) */
export function QuickChatDivider({ label, tone = 'muted', 'data-testid': testId }: QuickChatDividerProps) {
  const isPrimary = tone === 'primary';
  return (
    <div
      data-testid={testId}
      role='separator'
      aria-label={label}
      className='my-3 flex items-center gap-3'
    >
      <Separator className={cn('flex-1', isPrimary && 'bg-primary')} />
      <span
        className={cn(
          'shrink-0 text-[11px] tabular-nums',
          isPrimary ? 'font-medium text-primary' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
      <Separator className={cn('flex-1', isPrimary && 'bg-primary')} />
    </div>
  );
}
