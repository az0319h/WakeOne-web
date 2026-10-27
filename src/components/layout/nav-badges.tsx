'use client';

import { useQuery } from '@tanstack/react-query';
import { SidebarMenuBadge } from '@/components/ui/sidebar';
import { quickRequestUnreadTotalQueryOptions } from '@/features/quick-request/api/queries';
import { formatUnreadBadge } from '@/features/quick-request/components/chat/format-unread-badge';
import type { NavBadgeKey } from '@/types';

/**
 * plan 93 C-22 — 사이드바 「퀵 대화」 안 읽은 대화 수.
 * 집계 1개 값이라 non-suspense `useQuery`(staleTime 30s · refetchOnWindowFocus) — Suspense 경계 없이 안전.
 * 갱신은 `QuickChatUnreadRealtime`(dashboard layout)·`markRead` optimistic이 `unreadTotal`을 바꿀 때.
 */
function useQuickChatUnreadTotal(): number {
  const { data } = useQuery(quickRequestUnreadTotalQueryOptions());
  return data ?? 0;
}

/** 배지 훅 레지스트리 — `NavItem.badge` 키 → 숫자 훅 */
const NAV_BADGE_HOOKS: Record<NavBadgeKey, () => number> = {
  'quick-chat-unread': useQuickChatUnreadTotal
};

const NAV_BADGE_TEST_IDS: Record<NavBadgeKey, string> = {
  'quick-chat-unread': 'quick-chat-sidebar-badge'
};

type NavItemBadgeProps = {
  badgeKey: NavBadgeKey;
};

/** `SidebarNavLeafItem` 배지 슬롯 — 0이면 렌더 안 함 · 99+ · 접힘 모드는 `SidebarMenuBadge`가 숨긴다 */
export function NavItemBadge({ badgeKey }: NavItemBadgeProps) {
  const useBadgeCount = NAV_BADGE_HOOKS[badgeKey];
  const count = useBadgeCount();

  if (count <= 0) {
    return null;
  }

  return (
    <SidebarMenuBadge
      data-testid={NAV_BADGE_TEST_IDS[badgeKey]}
      aria-label={`안 읽은 대화 ${count}건`}
      className='rounded-full bg-primary px-1.5 text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground'
    >
      {formatUnreadBadge(count)}
    </SidebarMenuBadge>
  );
}
