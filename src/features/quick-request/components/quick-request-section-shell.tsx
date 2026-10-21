'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type QuickRequestSectionShellProps = {
  id: string;
  title: string;
  /** 제목 옆 「(선택)」 표기 */
  optional?: boolean;
  description?: string;
  /** 헤더 오른쪽 액션 슬롯 (예: 경유지 추가) */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function QuickRequestSectionShell({
  id,
  title,
  optional,
  description,
  action,
  children,
  className
}: QuickRequestSectionShellProps) {
  const titleId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={titleId} className={cn('scroll-mt-4 space-y-3', className)}>
      <div className='flex min-h-11 items-center justify-between gap-3'>
        <div className='min-w-0'>
          <h3 id={titleId} className='text-base font-semibold text-foreground'>
            {title}
            {optional ? (
              <span className='ml-1.5 text-sm font-normal text-muted-foreground'>(선택)</span>
            ) : null}
          </h3>
          {description ? <p className='text-sm text-muted-foreground'>{description}</p> : null}
        </div>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
