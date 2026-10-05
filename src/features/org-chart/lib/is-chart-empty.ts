import type { OrgChartNode } from '../api/types';

/** person·team 노드가 없으면 true (가상 루트만 있는 경우 포함) */
export function isOrgChartDisplayEmpty(nodes: OrgChartNode[]): boolean {
  if (nodes.length === 0) return true;
  return !nodes.some(
    (node) => node.nodeType === 'person' || node.nodeType === 'team'
  );
}
