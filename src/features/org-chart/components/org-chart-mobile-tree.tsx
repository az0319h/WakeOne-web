'use client';

import { useMemo } from 'react';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tree, TreeItem, TreeItemLabel } from '@/components/reui/tree';
import { getInitials } from '@/features/auth/components/profile-display';
import type { Affiliation } from '@/features/users/constants/organization';
import { formatPersonLabel } from '../lib/format-person-label';
import { isOrgChartDisplayEmpty } from '../lib/is-chart-empty';
import {
  ORG_CHART_VIRTUAL_ROOT_ID,
  buildOrgChartTreeBundle,
  type OrgChartTreeItemData
} from '../lib/org-chart-nodes-to-tree';
import type { OrgChartNode } from '../api/types';

const TREE_INDENT = 16;

interface OrgChartMobileTreeProps {
  nodes: OrgChartNode[];
  affiliation: Affiliation;
}

function OrgChartTreeEmptyState() {
  return (
    <div className='text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-sm'>
      <p>표시할 임직원이 없습니다.</p>
      <p className='text-xs'>
        사용자 관리에서 직급을 설정하면 조직도에 표시됩니다.
      </p>
    </div>
  );
}

export function OrgChartMobileTree({ nodes, affiliation }: OrgChartMobileTreeProps) {
  const treeBundle = useMemo(
    () => buildOrgChartTreeBundle(nodes, affiliation),
    [nodes, affiliation]
  );

  const tree = useTree<OrgChartTreeItemData>({
    initialState: {
      expandedItems: treeBundle.initialExpandedItems
    },
    indent: TREE_INDENT,
    rootItemId: treeBundle.rootItemId,
    getItemName: (item) => {
      const { node } = item.getItemData();
      if (node.nodeType === 'person') {
        return formatPersonLabel({
          fullName: node.fullName ?? node.name,
          positionLevel: node.positionLevel ?? '',
          leaderRole: node.leaderRole
        });
      }
      return node.name;
    },
    isItemFolder: (item) => (item.getItemData()?.children.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => treeBundle.items[itemId],
      getChildren: (itemId) => treeBundle.items[itemId]?.children ?? []
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature]
  });

  if (isOrgChartDisplayEmpty(nodes)) {
    return <OrgChartTreeEmptyState />;
  }

  return (
    <Tree indent={TREE_INDENT} tree={tree} toggleIconType='chevron'>
        {tree.getItems().map((item) => {
          if (item.getId() === ORG_CHART_VIRTUAL_ROOT_ID) {
            return null;
          }

          const { node } = item.getItemData();

          if (node.nodeType === 'person') {
            const fullName = node.fullName ?? node.name;
            const label = formatPersonLabel({
              fullName,
              positionLevel: node.positionLevel ?? '',
              leaderRole: node.leaderRole
            });

            return (
              <TreeItem key={item.getId()} item={item}>
                <TreeItemLabel className='gap-2'>
                  <Avatar className='h-8 w-8'>
                    {node.avatarUrl ? (
                      <AvatarImage src={node.avatarUrl} alt={fullName} />
                    ) : null}
                    <AvatarFallback className='text-xs'>
                      {getInitials({ full_name: fullName, email: fullName })}
                    </AvatarFallback>
                  </Avatar>
                  <span className='flex min-w-0 flex-col text-left'>
                    <span className='truncate'>{label}</span>
                    {node.rank ? (
                      <span className='text-muted-foreground truncate text-xs'>
                        {node.rank}
                      </span>
                    ) : null}
                  </span>
                </TreeItemLabel>
              </TreeItem>
            );
          }

          return (
            <TreeItem key={item.getId()} item={item}>
              <TreeItemLabel>{node.name}</TreeItemLabel>
            </TreeItem>
          );
        })}
    </Tree>
  );
}
