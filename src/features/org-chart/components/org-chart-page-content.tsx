'use client';

import { Suspense } from 'react';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { OrgChartDataBody } from './org-chart-data-body';
import { OrgChartTabs, useOrgChartAffiliation } from './org-chart-tabs';

export function OrgChartPageContent() {
  const [{ affiliation }] = useOrgChartAffiliation();

  return (
    <div
      data-testid='org-chart-page-content'
      className='flex flex-1 flex-col gap-6'
    >
      <OrgChartTabs />

      <Suspense
        key={affiliation}
        fallback={<PageLoadingSpinner variant='fill' />}
      >
        <OrgChartDataBody affiliation={affiliation} />
      </Suspense>
    </div>
  );
}
