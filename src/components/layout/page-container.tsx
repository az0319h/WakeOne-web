import React from 'react';
import { Heading } from '../ui/heading';
import type { InfobarContent } from '@/components/ui/infobar';
import { cn } from '@/lib/utils';

function PageSkeleton() {
  return (
    <div className='flex flex-1 animate-pulse flex-col gap-4 p-4 md:px-6'>
      <div className='flex items-center justify-between'>
        <div>
          <div className='bg-muted mb-2 h-8 w-48 rounded' />
          <div className='bg-muted h-4 w-96 rounded' />
        </div>
      </div>
      <div className='bg-muted mt-6 h-40 w-full rounded-lg' />
      <div className='bg-muted h-40 w-full rounded-lg' />
    </div>
  );
}

export default function PageContainer({
  children,
  isLoading = false,
  access = true,
  accessFallback,
  pageTitle,
  pageDescription,
  infoContent,
  pageHeaderAction,
  viewportFill = false
}: {
  children: React.ReactNode;
  isLoading?: boolean;
  access?: boolean;
  accessFallback?: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  infoContent?: InfobarContent;
  pageHeaderAction?: React.ReactNode;
  /** tabs 아래 콘텐츠가 남은 viewport를 채울 때 (조직도 등) */
  viewportFill?: boolean;
}) {
  if (!access) {
    return (
      <div className='flex flex-1 items-center justify-center p-4 md:px-6'>
        {accessFallback ?? (
          <div className='text-muted-foreground text-center text-lg'>
            You do not have access to this page.
          </div>
        )}
      </div>
    );
  }

  const content = isLoading ? <PageSkeleton /> : children;

  const hasHeader = pageTitle || pageHeaderAction;

  const header = hasHeader ? (
    <div className='mb-4 flex shrink-0 items-start justify-between gap-4'>
      <Heading
        title={pageTitle ?? ''}
        description={pageDescription ?? ''}
        infoContent={infoContent}
      />
      {pageHeaderAction && <div className='shrink-0'>{pageHeaderAction}</div>}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col px-4 pt-2 pb-4 md:px-6 md:pt-4',
        viewportFill ? 'min-h-0 flex-1 overflow-hidden' : 'flex-1'
      )}
    >
      {viewportFill ? (
        <>
          {header}
          <div className='flex min-h-0 flex-1 flex-col'>{content}</div>
        </>
      ) : (
        <>
          {header}
          {content}
        </>
      )}
    </div>
  );
}
