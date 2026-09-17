'use client';

import { useEffect, useRef, useState } from 'react';

import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { DataTableScrollContainer } from '@/components/ui/table/data-table-scroll-container';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';

import type { WalletBalanceEmailLogRecipient } from '../../api/types';
import { RecipientStatusBadge } from './status-badges';

export const RECIPIENTS_PAGE_SIZE = 10;

type RecipientsInfiniteTableProps = {
  recipients: WalletBalanceEmailLogRecipient[];
  runId: number;
};

export function RecipientsInfiniteTable({ recipients, runId }: RecipientsInfiniteTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const canLoadMoreRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(RECIPIENTS_PAGE_SIZE);

  const visibleRecipients = recipients.slice(0, visibleCount);
  const hasMore = visibleCount < recipients.length;

  useEffect(() => {
    setVisibleCount(RECIPIENTS_PAGE_SIZE);
    canLoadMoreRef.current = false;
  }, [recipients, runId]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) {
      return;
    }

    const onScroll = () => {
      canLoadMoreRef.current = true;

      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 24) {
        setVisibleCount((current) => {
          if (current >= recipients.length) {
            return current;
          }
          return Math.min(current + RECIPIENTS_PAGE_SIZE, recipients.length);
        });
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [recipients.length]);

  useEffect(() => {
    const node = loadMoreRef.current;
    const root = scrollRef.current;
    if (!node || !root || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const scrolled =
          canLoadMoreRef.current ||
          root.scrollTop > 0 ||
          root.scrollHeight <= root.clientHeight;

        if (entries[0]?.isIntersecting && scrolled) {
          setVisibleCount((current) =>
            Math.min(current + RECIPIENTS_PAGE_SIZE, recipients.length)
          );
        }
      },
      {
        root,
        rootMargin: '120px'
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, recipients.length]);

  return (
    <div
      ref={scrollRef}
      className='min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1'
      data-testid='wallet-balance-email-log-recipients-scroll'
    >
      <DataTableScrollContainer>
        <Table
          className='w-max min-w-full'
          data-testid='wallet-balance-email-log-recipients-table'
        >
          <TableHeader className='bg-background sticky top-0 z-10'>
            <TableRow>
              <TableHead>수신자</TableHead>
              <TableHead>user_id</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>발송 시각</TableHead>
              <TableHead>오류</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRecipients.length > 0 ? (
              visibleRecipients.map((recipient) => (
                <TableRow key={recipient.id}>
                  <TableCell className='max-w-[220px]'>
                    <div className='flex min-w-0 flex-col'>
                      <span className='truncate text-sm font-medium'>
                        {recipient.recipient_full_name ?? '—'}
                      </span>
                      <span className='text-muted-foreground truncate text-xs'>
                        {recipient.recipient_email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className='max-w-[120px] truncate font-mono text-xs'>
                    {recipient.user_id}
                  </TableCell>
                  <TableCell>
                    <RecipientStatusBadge status={recipient.status} />
                  </TableCell>
                  <TableCell className='font-mono text-xs whitespace-nowrap'>
                    {recipient.sent_at ? formatAbsoluteDateTimeKo(recipient.sent_at) : '—'}
                  </TableCell>
                  <TableCell className='text-destructive max-w-[180px] truncate text-xs'>
                    {recipient.error_message ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='text-muted-foreground h-16 text-center text-sm'
                >
                  발송된 수신자가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableScrollContainer>
      {hasMore ? (
        <div
          ref={loadMoreRef}
          className='flex justify-center py-4'
          data-testid='wallet-balance-email-log-recipients-load-more'
        >
          <PageLoadingSpinner variant='compact' />
        </div>
      ) : null}
    </div>
  );
}
