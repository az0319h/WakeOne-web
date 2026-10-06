import type { Affiliation } from '@/features/users/constants/organization';
import type { OrgChartNode } from '../api/types';

/** 점장 > 부점장 > 선임매니저 == 쉐프 > 매니저 */
const SANS_PEER_TIER = new Set(['선임매니저', '쉐프']);

export type D3ChartDatum = {
  id: string;
  parentId: string | null;
  name: string;
  nodeType: OrgChartNode['nodeType'];
  userId?: string;
};

function sansMemberTierKey(positionLevel: string | undefined): string {
  if (positionLevel && SANS_PEER_TIER.has(positionLevel)) {
    return 'sans_peer_tier';
  }
  return positionLevel ?? 'unknown';
}

/** 팀 멤버 d3 parent 연결 — wake/foundry: 세로 체인, sans: 선임매니저·쉐프만 형제 가로 */
export function toD3TeamMemberLayout(
  nodes: OrgChartNode[],
  affiliation: Affiliation
): D3ChartDatum[] {
  const parentOverride = new Map<string, string>();

  for (const node of nodes) {
    if (node.nodeType !== 'team') continue;

    const members = nodes.filter(
      (child) => child.parentId === node.id && child.nodeType === 'person'
    );

    if (members.length <= 1) continue;

    if (affiliation === 'sans') {
      let chainAnchorId = node.id;
      let index = 0;

      while (index < members.length) {
        const tierKey = sansMemberTierKey(members[index].positionLevel);
        let end = index + 1;

        while (
          end < members.length &&
          sansMemberTierKey(members[end].positionLevel) === tierKey
        ) {
          end++;
        }

        const group = members.slice(index, end);

        for (const member of group) {
          parentOverride.set(member.id, chainAnchorId);
        }

        chainAnchorId = group[0].id;
        index = end;
      }

      continue;
    }

    for (let i = 1; i < members.length; i++) {
      parentOverride.set(members[i].id, members[i - 1].id);
    }
  }

  return nodes.map((node) => ({
    id: node.id,
    parentId: parentOverride.get(node.id) ?? node.parentId,
    name: node.name,
    nodeType: node.nodeType,
    userId: node.userId
  }));
}
