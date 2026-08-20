import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';

interface SupportTimestampsProps {
  createdAt: string;
  updatedAt: string;
  className?: string;
}

function isSupportUpdated(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() > new Date(createdAt).getTime();
}

export function SupportTimestamps({ createdAt, updatedAt, className }: SupportTimestampsProps) {
  const updated = isSupportUpdated(createdAt, updatedAt);

  return (
    <div className={cn('text-muted-foreground space-y-0.5 font-mono text-xs', className)}>
      <p className='whitespace-nowrap'>등록됨 {formatAbsoluteDateTimeKo(createdAt)}</p>
      {updated ? (
        <p className='whitespace-nowrap'>수정됨 {formatAbsoluteDateTimeKo(updatedAt)}</p>
      ) : null}
    </div>
  );
}
