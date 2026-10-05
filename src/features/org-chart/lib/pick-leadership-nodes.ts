import type { Affiliation } from '@/features/users/constants/organization';
import type { OrgChartNode } from '../api/types';

const LEADERSHIP_POSITION_ORDER: Record<Affiliation, readonly string[]> = {
  wake: ['CEO', 'COO'],
  sans: ['CEO'],
  sans_foundry: ['CEO', '공장장']
};

function nodeById(nodes: OrgChartNode[]): Map<string, OrgChartNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function isPersonUnderTeam(
  node: OrgChartNode,
  byId: Map<string, OrgChartNode>
): boolean {
  if (!node.parentId) return false;
  const parent = byId.get(node.parentId);
  return parent?.nodeType === 'team';
}

export function pickLeadershipNodes(
  nodes: OrgChartNode[],
  affiliation: Affiliation
): OrgChartNode[] {
  const byId = nodeById(nodes);
  const order = LEADERSHIP_POSITION_ORDER[affiliation];
  const orderIndex = new Map(order.map((level, index) => [level, index]));

  const leaders = nodes.filter(
    (node) => node.nodeType === 'person' && !isPersonUnderTeam(node, byId)
  );

  return leaders.toSorted((a, b) => {
    const aOrder = orderIndex.get(a.positionLevel ?? '') ?? order.length;
    const bOrder = orderIndex.get(b.positionLevel ?? '') ?? order.length;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return (a.fullName ?? a.name).localeCompare(b.fullName ?? b.name, 'ko');
  });
}
