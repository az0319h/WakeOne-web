import { formatAbsoluteDateKo } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { formatDdayLabel } from '../lib/format';

type AssetDateWithDdayProps = {
  date: string | null;
  className?: string;
};

/** 만료·갱신일 — 날짜(`yyyy-MM-dd`) + 30일 이내면 주황 「D-N」(KST 오늘 기준) · 없으면 「—」 */
export function AssetDateWithDday({ date, className }: AssetDateWithDdayProps) {
  if (!date) {
    return <span className='text-muted-foreground'>—</span>;
  }
  const dday = formatDdayLabel(date);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span className='font-mono tabular-nums'>{formatAbsoluteDateKo(date)}</span>
      {dday ? (
        <span className='text-xs font-medium text-orange-700 tabular-nums dark:text-orange-400'>
          {dday}
        </span>
      ) : null}
    </span>
  );
}
