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

type PageContainerProps = {
  children: React.ReactNode;
  isLoading?: boolean;
  access?: boolean;
  accessFallback?: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  infoContent?: InfobarContent;
  pageHeaderAction?: React.ReactNode;
  /**
   * plan 106 D-2 — `'hidden'`이면 lg(1024) 미만에서 제목·설명·ⓘ·`pageHeaderAction` 묶음을 숨긴다.
   * DOM은 SSR·PC와 같고 CSS(`max-lg:hidden`)로만 숨긴다 — 화면 이름은 상단바 breadcrumb가 맡는다.
   */
  mobileHeader?: 'visible' | 'hidden';
  /**
   * tabs 아래 콘텐츠가 남은 viewport를 채울 때 (조직도 등).
   * plan 106 — `'lg'`이면 lg 이상에서만 채움·overflow 차단, lg 미만은 일반 문서 흐름(페이지 스크롤 · sticky 동작).
   */
  viewportFill?: boolean | 'lg';
};

function resolveViewportFillClassNames(viewportFill: boolean | 'lg') {
  if (viewportFill === 'lg') {
    return { root: 'flex-1 lg:min-h-0 lg:overflow-hidden', body: 'flex flex-1 flex-col lg:min-h-0' };
  }
  if (viewportFill) {
    return { root: 'min-h-0 flex-1 overflow-hidden', body: 'flex min-h-0 flex-1 flex-col' };
  }
  return { root: 'flex-1', body: null };
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
  mobileHeader = 'visible',
  viewportFill = false
}: PageContainerProps) {
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
    <div
      className={cn(
        'mb-4 flex shrink-0 items-start justify-between gap-4',
        mobileHeader === 'hidden' && 'max-lg:hidden'
      )}
    >
      <Heading
        title={pageTitle ?? ''}
        description={pageDescription ?? ''}
        infoContent={infoContent}
      />
      {pageHeaderAction && <div className='shrink-0'>{pageHeaderAction}</div>}
    </div>
  ) : null;

  const fill = resolveViewportFillClassNames(viewportFill);

  return (
    <div className={cn('flex min-w-0 flex-col px-4 pt-2 pb-4 md:px-6 md:pt-4', fill.root)}>
      {header}
      {fill.body ? <div className={fill.body}>{content}</div> : content}
    </div>
  );
}
