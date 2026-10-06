'use client';

import { useEffect, useRef } from 'react';
import { OrgChart } from 'd3-org-chart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { Affiliation } from '@/features/users/constants/organization';
import { useOrgChartPersonHover } from '../hooks/use-org-chart-person-hover';
import { isOrgChartDisplayEmpty } from '../lib/is-chart-empty';
import { toD3TeamMemberLayout, type D3ChartDatum } from '../lib/team-member-layout';
import type { OrgChartNode } from '../api/types';
import { OrgChartPersonHoverCard } from './org-chart-person-hover-card';

function OrgChartEmptyState() {
  return (
    <div className='text-muted-foreground flex min-h-[480px] flex-col items-center justify-center gap-2 px-6 text-center text-sm'>
      <p>표시할 임직원이 없습니다.</p>
      <p className='text-xs'>
        사용자 관리에서 직급(position_level)을 설정하면 조직도에 표시됩니다.
        <br />
        CEO·COO는 직급을 CEO 또는 COO로 지정해 주세요.
      </p>
    </div>
  );
}

interface OrgChartD3CanvasProps {
  nodes: OrgChartNode[];
  affiliation: Affiliation;
  className?: string;
}

function renderNodeContent(node: { data: D3ChartDatum }): string {
  const { name, nodeType, userId } = node.data;
  const isPerson = nodeType === 'person';
  const personAttrs =
    isPerson && userId
      ? `data-org-chart-person="true" data-user-id="${userId}" data-testid="org-chart-person-node-${userId}"`
      : '';

  return `
    <div ${personAttrs} class="rounded-lg border bg-card text-card-foreground shadow-sm px-3 py-2 min-w-[140px] max-w-[220px]">
      <p class="text-xs font-medium leading-snug ${isPerson ? 'text-foreground' : 'text-muted-foreground'}">${name}</p>
    </div>
  `;
}

export function OrgChartD3Canvas({
  nodes,
  affiliation,
  className
}: OrgChartD3CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<OrgChart<D3ChartDatum> | null>(null);

  const { activeContact, anchorRect, closeImmediately, isOpen } =
    useOrgChartPersonHover(containerRef, nodes);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || nodes.length === 0) {
      return;
    }

    const data = toD3TeamMemberLayout(nodes, affiliation);

    if (!chartRef.current) {
      chartRef.current = new OrgChart<D3ChartDatum>()
        .container(container)
        .data(data)
        .nodeWidth(() => 200)
        .nodeHeight(() => 72)
        .childrenMargin(() => 40)
        .compact(false)
        .nodeContent((node: { data: D3ChartDatum }) => renderNodeContent(node))
        .render()
        .expandAll()
        .fit();
    } else {
      chartRef.current.data(data).render().expandAll().fit();
    }
  }, [affiliation, nodes]);

  useEffect(() => {
    const container = containerRef.current;

    return () => {
      if (container) {
        container.innerHTML = '';
      }
      chartRef.current = null;
    };
  }, []);

  const handleZoomIn = () => {
    closeImmediately();
    chartRef.current?.zoomIn?.();
  };

  const handleZoomOut = () => {
    closeImmediately();
    chartRef.current?.zoomOut?.();
  };

  const handleFit = () => {
    closeImmediately();
    chartRef.current?.fit?.();
  };

  if (isOrgChartDisplayEmpty(nodes)) {
    return <OrgChartEmptyState />;
  }

  return (
    <>
      <Card className={cn('relative min-h-[480px] overflow-hidden', className)}>
        <div className='absolute top-3 right-3 z-10 flex gap-1'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            onClick={handleZoomIn}
            aria-label='확대'
          >
            <Icons.add className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            onClick={handleZoomOut}
            aria-label='축소'
          >
            <Icons.minus className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            onClick={handleFit}
            aria-label='화면 맞춤'
          >
            <Icons.chevronsDown className='h-4 w-4' />
          </Button>
        </div>

        <div
          ref={containerRef}
          data-testid='org-chart-canvas'
          className='h-[480px] w-full'
        />
      </Card>

      <OrgChartPersonHoverCard
        open={isOpen}
        anchorRect={anchorRect}
        contact={activeContact}
      />
    </>
  );
}
