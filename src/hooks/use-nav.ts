'use client';

import { isDongbangAllowedPage } from '@/config/dongbang-routes';
import { checkNavAccess, useNavAccess, useNavAccessFlags } from '@/contexts/nav-access';
import { isDongbangAffiliation } from '@/features/users/constants/organization';
import type { NavGroup, NavItem } from '@/types';

/** 동방특송 nav에서 빼는 경로 — 프로필은 사이드바 하단 사용자 메뉴로만 (AC-03) */
const DONGBANG_HIDDEN_NAV_URLS = new Set(['/dashboard/profile']);

/**
 * plan 89 — 동방특송은 proxy와 같은 allowlist 함수로 거른다.
 * prefix(`/dashboard/quick`)로 거르면 `/dashboard/quick/request`도 통과하므로 함수로 판정한다.
 */
function isNavUrlAllowedForProfile(url: string, profile: ReturnType<typeof useNavAccess>): boolean {
  if (!isDongbangAffiliation(profile?.affiliation)) {
    return true;
  }
  return isDongbangAllowedPage(url) && !DONGBANG_HIDDEN_NAV_URLS.has(url);
}

function filterNavItem(
  item: NavItem,
  profile: ReturnType<typeof useNavAccess>,
  flags: ReturnType<typeof useNavAccessFlags>
): NavItem | null {
  if (!checkNavAccess(item.access, profile, flags)) {
    return null;
  }

  if (item.url !== '#' && !isNavUrlAllowedForProfile(item.url, profile)) {
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
