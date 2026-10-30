'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { cn } from '@/lib/utils';
import type { SupportListItem } from '../api/types';
import { SupportStatusBadge } from './support-status-badge';

interface SupportListRowProps {
  request: SupportListItem;
  isAdmin?: boolean;
  onClick: (request: SupportListItem) => void;
  className?: string;
}

export function SupportListRow({
  request,
  isAdmin = false,
  onClick,
  className
}: SupportListRowProps) {
  return (
    <div
      className={cn('border-border/80 flex items-center border-b', className)}
      data-testid={`support-row-${request.id}`}
    >
      <Button
        type='button'
        variant='ghost'
        className={cn(
          'h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-0 py-3 text-left font-normal whitespace-normal md:py-4',
          'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
        )}
        onClick={() => onClick(request)}
      >
        {/* 모바일(768px 미만) 2줄: 1줄 상태·제목 / 2줄 제출자·등록 시각 — md 이상은 기존 한 줄 */}
        <span className='flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-3'>
          <span className='flex min-w-0 items-center gap-2 md:contents'>
            <SupportStatusBadge status={request.status} className='shrink-0 md:order-1' />
            <span className='min-w-0 flex-1 truncate text-sm md:order-3'>{request.title}</span>
          </span>

          <span className='text-muted-foreground flex min-w-0 items-center gap-2 text-xs md:contents'>
            {isAdmin ? (
              <span className='flex min-w-0 flex-col md:order-2 md:shrink-0'>
                <span className='truncate text-xs font-medium md:text-foreground'>
                  {request.submitter_name}
                </span>
                <span className='text-muted-foreground hidden truncate text-xs md:block'>
                  {request.submitter_email}
                </span>
              </span>
            ) : null}

            <time
              dateTime={request.created_at}
              className='text-muted-foreground shrink-0 font-mono text-xs whitespace-nowrap md:order-4'
            >
              {formatAbsoluteDateTimeKo(request.created_at)}
            </time>
          </span>
        </span>

        <Icons.chevronRight aria-hidden className='text-muted-foreground/40 size-5 shrink-0' />
      </Button>
    </div>
  );
}
