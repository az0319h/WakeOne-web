'use client';

import { Icons } from '@/components/icons';
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
      <button
        type='button'
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 py-4 text-left transition-colors',
          'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none'
        )}
        onClick={() => onClick(request)}
      >
        <SupportStatusBadge status={request.status} />

        {isAdmin ? (
          <div className='hidden min-w-0 shrink-0 flex-col sm:flex'>
            <span className='truncate text-xs font-medium'>{request.submitter_name}</span>
            <span className='text-muted-foreground truncate text-xs'>{request.submitter_email}</span>
          </div>
        ) : null}

        <span className='min-w-0 flex-1 truncate text-sm'>{request.title}</span>

        <time
          dateTime={request.created_at}
          className='text-muted-foreground shrink-0 font-mono text-xs whitespace-nowrap'
        >
          {formatAbsoluteDateTimeKo(request.created_at)}
        </time>

        <Icons.chevronRight aria-hidden className='text-muted-foreground/40 size-5 shrink-0' />
      </button>
    </div>
  );
}
