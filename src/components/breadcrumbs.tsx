'use client';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { useBreadcrumbs } from '@/hooks/use-breadcrumbs';
import { Icons } from '@/components/icons';
import { Fragment } from 'react';

/**
 * 공통 상단바 breadcrumb.
 * plan 106 D-1(태블릿 768~1023 = 휴대폰 규칙) — lg 미만은 마지막 항목(현재 화면 이름)만 한 줄로, 넘치면 말줄임.
 * lg 이상은 전체 경로 그대로.
 */
export function Breadcrumbs() {
  const items = useBreadcrumbs();
  if (items.length === 0) return null;

  return (
    <Breadcrumb className='max-lg:min-w-0'>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={item.title}>
            {index !== items.length - 1 && (
              <BreadcrumbItem className='hidden lg:block'>
                <BreadcrumbLink href={item.link}>{item.title}</BreadcrumbLink>
              </BreadcrumbItem>
            )}
            {index < items.length - 1 && (
              <BreadcrumbSeparator className='hidden lg:block'>
                <Icons.slash />
              </BreadcrumbSeparator>
            )}
            {index === items.length - 1 && (
              <BreadcrumbPage className='max-lg:truncate'>{item.title}</BreadcrumbPage>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
