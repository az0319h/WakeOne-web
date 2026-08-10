import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import { isAnnouncementUpdated } from './announcement-utils';

interface AnnouncementTimestampsProps {
  createdAt: string;
  updatedAt: string;
  className?: string;
}

export function AnnouncementTimestamps({
  createdAt,
  updatedAt,
  className
}: AnnouncementTimestampsProps) {
  const updated = isAnnouncementUpdated(createdAt, updatedAt);

  return (
    <div className={cn('text-muted-foreground space-y-0.5 font-mono text-xs', className)}>
      <p className='whitespace-nowrap'>등록됨 {formatAbsoluteDateTimeKo(createdAt)}</p>
      {updated ? (
        <p className='whitespace-nowrap'>수정됨 {formatAbsoluteDateTimeKo(updatedAt)}</p>
      ) : null}
    </div>
  );
}
