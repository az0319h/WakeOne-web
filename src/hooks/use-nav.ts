'use client';

import { checkNavAccess, useNavAccess, useNavAccessFlags } from '@/contexts/nav-access';
import type { NavGroup, NavItem } from '@/types';

function filterNavItem(
  item: NavItem,
  profile: ReturnType<typeof useNavAccess>,
  flags: ReturnType<typeof useNavAccessFlags>
): NavItem | null {
  if (!checkNavAccess(item.access, profile, flags)) {
    return null;
  }

  if (item.items && item.items.length > 0) {
    const filteredChildren = item.items
      .map((child) => filterNavItem(child, profile, flags))
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
  const flags = useNavAccessFlags();

  return items
    .map((item) => filterNavItem(item, profile, flags))
    .filter((item): item is NavItem => item !== null);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const profile = useNavAccess();
  const flags = useNavAccessFlags();

  return groups
    .map((group) => {
      const items = group.items
        .map((item) => filterNavItem(item, profile, flags))
        .filter((item): item is NavItem => item !== null);

      if (items.length === 0) {
        return null;
      }

      return { ...group, items };
    })
    .filter((group): group is NavGroup => group !== null);
}
