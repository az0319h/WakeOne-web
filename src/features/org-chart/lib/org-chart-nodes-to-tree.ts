import type { Affiliation } from '@/features/users/constants/organization';
import type { OrgChartNode } from '../api/types';

export const ORG_CHART_VIRTUAL_ROOT_ID = '__org_chart_virtual_root__';

export type OrgChartTreeItemData = {
  node: OrgChartNode;
  children: string[];
};

export type OrgChartTreeBundle = {
  rootItemId: string;
  items: Record<string, OrgChartTreeItemData>;
  initialExpandedItems: string[];
};

function buildChildrenByParentId(
  layoutNodes: { id: string; parentId: string | null }[],
  nodeOrder: string[]
): Map<string | null, string[]> {
  const orderIndex = new Map(nodeOrder.map((id, index) => [id, index]));
  const map = new Map<string | null, string[]>();

  for (const node of layoutNodes) {
    const list = map.get(node.parentId) ?? [];
    list.push(node.id);
    map.set(node.parentId, list);
  }

  for (const [parentId, children] of map.entries()) {
    children.sort(
      (left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0)
    );
    map.set(parentId, children);
  }

  return map;
}

function collectAllExpandedFolderIds(
  rootItemId: string,
  items: Record<string, OrgChartTreeItemData>
): string[] {
  const expanded = new Set<string>([rootItemId]);

  for (const [id, item] of Object.entries(items)) {
    if (item.children.length > 0) {
      expanded.add(id);
    }
  }

  return [...expanded];
}

/** API parentId + 배열 순서 그대로 — 팀 expand 시 멤버 flat 표시 (headless-tree sync loader) */
export function buildOrgChartTreeBundle(
  nodes: OrgChartNode[],
  _affiliation: Affiliation
): OrgChartTreeBundle {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeOrder = nodes.map((node) => node.id);
  const layout = nodes.map((node) => ({ id: node.id, parentId: node.parentId }));
  const childrenByParent = buildChildrenByParentId(layout, nodeOrder);
  const rootIds = childrenByParent.get(null) ?? [];
  const items: Record<string, OrgChartTreeItemData> = {};

  // headless-tree getItems() omits rootItemId — single CEO/root would never render.
  // Always anchor under a hidden virtual root so top-level nodes (CEO 등) appear in the tree.
  const rootItemId = ORG_CHART_VIRTUAL_ROOT_ID;
  items[ORG_CHART_VIRTUAL_ROOT_ID] = {
    node: {
      id: ORG_CHART_VIRTUAL_ROOT_ID,
      parentId: null,
      name: '',
      nodeType: 'root'
    },
    children: rootIds
  };

  for (const layoutNode of layout) {
    const node = nodeById.get(layoutNode.id);
    if (!node) continue;

    items[layoutNode.id] = {
      node,
      children: childrenByParent.get(layoutNode.id) ?? []
    };
  }

  const initialExpandedItems = collectAllExpandedFolderIds(rootItemId, items);

  return { rootItemId, items, initialExpandedItems };
}
