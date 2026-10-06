'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import type { Affiliation } from '@/features/users/constants/organization';
import { orgChartQueryOptions } from '../api/queries';
import { OrgChartMobileTree } from './org-chart-mobile-tree';

const OrgChartD3Canvas = dynamic(
  () =>
    import('./org-chart-d3-canvas').then((mod) => mod.OrgChartD3Canvas),
  { ssr: false }
);

interface OrgChartDataBodyProps {
  affiliation: Affiliation;
}

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

function subscribeToDesktopMediaQuery(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getDesktopMediaQuerySnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getDesktopMediaQueryServerSnapshot() {
  return false;
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeToDesktopMediaQuery,
    getDesktopMediaQuerySnapshot,
    getDesktopMediaQueryServerSnapshot
  );
}

function useIsClientMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

export function OrgChartDataBody({ affiliation }: OrgChartDataBodyProps) {
  const { data } = useSuspenseQuery(orgChartQueryOptions(affiliation));
  const isDesktop = useIsDesktop();
  const isClientMounted = useIsClientMounted();

  if (!isClientMounted) {
    return <PageLoadingSpinner variant='fill' />;
  }

  if (isDesktop) {
    return (
      <OrgChartD3Canvas
        key='org-chart-desktop'
        nodes={data.nodes}
        affiliation={affiliation}
      />
    );
  }

  return (
    <div
      key='org-chart-mobile'
      data-testid='org-chart-mobile-tree'
      className='flex flex-1 flex-col'
    >
      <OrgChartMobileTree nodes={data.nodes} affiliation={affiliation} />
    </div>
  );
}
