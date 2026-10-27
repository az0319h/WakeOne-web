import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type QuickDetailSectionProps = {
  title: string;
  description?: string;
  /** 헤더 오른쪽 슬롯 */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
};

/** 상세 섹션 Card — 테두리만 (shadow-none · designer §3.3) */
export function QuickDetailSection({
  title,
  description,
  action,
  children,
  className,
  'data-testid': testId
}: QuickDetailSectionProps) {
  return (
    <Card data-testid={testId} className={cn('min-w-0 gap-4 py-5 shadow-none', className)}>
      <CardHeader className='flex items-start justify-between gap-3 px-5'>
        <div className='min-w-0 space-y-1'>
          <h3 className='text-base font-semibold text-foreground'>{title}</h3>
          {description ? <p className='text-sm text-muted-foreground'>{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className='min-w-0 px-5'>{children}</CardContent>
    </Card>
  );
}

type QuickDetailRowProps = {
  label: string;
  children: ReactNode;
};

/** `<dl>` 한 줄 — 라벨 / 값 */
export function QuickDetailRow({ label, children }: QuickDetailRowProps) {
  return (
    <>
      <dt className='text-sm break-keep text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 text-sm break-words text-foreground'>{children}</dd>
    </>
  );
}

export const QUICK_DETAIL_DL_CLASS =
  'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2';
