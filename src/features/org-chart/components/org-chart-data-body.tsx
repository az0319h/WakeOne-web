'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { Affiliation } from '@/features/users/constants/organization';
import { orgChartQueryOptions } from '../api/queries';
import { OrgChartDrillDown } from './org-chart-drill-down';

const OrgChartD3Canvas = dynamic(
  () =>
    import('./org-chart-d3-canvas').then((mod) => mod.OrgChartD3Canvas),
  { ssr: false }
);

interface OrgChartDataBodyProps {
  affiliation: Affiliation;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

export function OrgChartDataBody({ affiliation }: OrgChartDataBodyProps) {
  const { data } = useSuspenseQuery(orgChartQueryOptions(affiliation));
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return <OrgChartD3Canvas nodes={data.nodes} affiliation={affiliation} />;
  }

  return <OrgChartDrillDown nodes={data.nodes} affiliation={affiliation} />;
}
