'use client';

import { checkNavAccess, useNavAccess } from '@/contexts/nav-access';
import type { NavGroup, NavItem } from '@/types';

function filterNavItem(item: NavItem, profile: ReturnType<typeof useNavAccess>): NavItem | null {
  if (!checkNavAccess(item.access, profile)) {
    return null;
  }

  if (item.items && item.items.length > 0) {
    const filteredChildren = item.items
      .map((child) => filterNavItem(child, profile))
      .filter((child): child is NavItem => child !== null);

    if (filteredChildren.length === 0 && item.url === '#') {
      return null;
    }

    return { ...item, items: filteredChildren };
  }

  return item;
}

export function useFilteredNavItems(items: NavItem[]) {
  const profile = useNavAccess();

  return items
    .map((item) => filterNavItem(item, profile))
    .filter((item): item is NavItem => item !== null);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const profile = useNavAccess();

  return groups
    .map((group) => {
      const items = group.items
        .map((item) => filterNavItem(item, profile))
        .filter((item): item is NavItem => item !== null);

      if (items.length === 0) {
        return null;
      }

      return { ...group, items };
    })
    .filter((group): group is NavGroup => group !== null);
}
