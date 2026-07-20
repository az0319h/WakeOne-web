'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import type { OfficeSnackSession } from '../api/types';
import {
  canAdminDeleteOfficeSnackSession,
  getSessionRowDeadline,
  getSessionStateDescription,
  getSessionStateLabel
} from './office-snack-utils';

interface SessionTransferRowProps {
  session: OfficeSnackSession;
  isAdmin?: boolean;
  isDeleting?: boolean;
  onDelete?: (session: OfficeSnackSession) => void;
}

function SessionStatusBadge({ session }: { session: OfficeSnackSession }) {
  const label = getSessionStateLabel(session.state);

  if (session.state === 'closed') {
    return (
      <span className='bg-foreground text-background inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium'>
        {label}
      </span>
    );
  }

  if (session.state === 'upcoming') {
    return <span className='text-amber-600 dark:text-amber-400 text-xs font-medium'>{label}</span>;
  }

  return (
    <span className='text-amber-600 dark:text-amber-400 text-xs font-medium'>
      {label}
    </span>
  );
}

export function SessionTransferRow({
  session,
  isAdmin = false,
  isDeleting = false,
  onDelete
}: SessionTransferRowProps) {
  const deadline = getSessionRowDeadline(session);
  const canDelete = isAdmin && canAdminDeleteOfficeSnackSession(session.state) && !!onDelete;

  return (
    <div className='group relative flex items-center'>
      <Link
        href={`/dashboard/office-snacks/${session.id}`}
        className={cn(
          'hover:bg-muted/50 focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors',
          'focus-visible:ring-[3px] focus-visible:outline-none',
          canDelete && 'pr-12'
        )}
      >
        <div
          className='bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full'
          aria-hidden
        >
          <Icons.pizza className='h-5 w-5' />
        </div>

        <div className='min-w-0 flex-1'>
          <p className='truncate font-medium'>{session.title}</p>
          <p className='text-muted-foreground truncate text-sm italic'>
            {getSessionStateDescription(session)}
          </p>
        </div>

        <div className='flex shrink-0 flex-col items-end gap-1 text-right'>
          <p className='hidden text-sm font-semibold sm:block'>{deadline.label}</p>
          <p className='text-muted-foreground text-xs font-mono whitespace-nowrap'>
            {formatAbsoluteDateTimeKo(deadline.at)}
          </p>
          <SessionStatusBadge session={session} />
        </div>
      </Link>

      {canDelete ? (
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className='text-destructive hover:text-destructive absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'
          isLoading={isDeleting}
          aria-label={`${session.title} 회차 삭제`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(session);
          }}
        >
          <Icons.trash className='h-4 w-4' />
        </Button>
      ) : null}
    </div>
  );
}
