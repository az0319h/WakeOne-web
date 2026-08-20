'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  SUPPORT_PAGE_SIZE,
  supportInfiniteQueryOptions
} from '../api/queries';
import type { SupportListItem } from '../api/types';
import { hasActiveSupportFilters } from '../api/filter-utils';
import { useSupportListFilterParams } from './support-list-filters';
import { SupportListRow } from './support-list-row';

interface SupportInfiniteListProps {
  isAdmin?: boolean;
  onRowClick: (request: SupportListItem) => void;
  emptyMessage?: string;
  className?: string;
}

function flattenSupportRequests(
  pages: { requests: SupportListItem[] }[] | undefined
): SupportListItem[] {
  if (!pages) {
    return [];
  }

  const seen = new Set<number>();
  const result: SupportListItem[] = [];

  for (const page of pages) {
    for (const request of page.requests) {
      if (!seen.has(request.id)) {
        seen.add(request.id);
        result.push(request);
      }
    }
  }

  return result;
}

export function SupportInfiniteList({
  isAdmin = false,
  onRowClick,
  emptyMessage = '등록된 문의가 없습니다.',
  className
}: SupportInfiniteListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { filters } = useSupportListFilterParams();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(supportInfiniteQueryOptions(filters));

  const requests = useMemo(() => flattenSupportRequests(data.pages), [data.pages]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '120px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (requests.length === 0) {
    const filteredEmptyMessage = hasActiveSupportFilters(filters)
      ? '조건에 맞는 문의가 없습니다.'
      : emptyMessage;

    return (
      <div className={className} data-testid='support-empty'>
        <div className='flex flex-col items-center justify-center py-16'>
          <Icons.help className='text-muted-foreground/40 mb-3 h-10 w-10' />
          <p className='text-muted-foreground text-sm'>{filteredEmptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid='support-infinite-list'>
      <div className='flex flex-col'>
        {requests.map((request) => (
          <SupportListRow
            key={request.id}
            request={request}
            isAdmin={isAdmin}
            onClick={onRowClick}
          />
        ))}
      </div>
      <div ref={loadMoreRef} className='flex justify-center py-4'>
        {isFetchingNextPage ? <PageLoadingSpinner variant='compact' /> : null}
      </div>
    </div>
  );
}

export { SUPPORT_PAGE_SIZE };
