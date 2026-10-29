'use client';

import { useQuery } from '@tanstack/react-query';
import { SidebarMenuBadge } from '@/components/ui/sidebar';
import { quickRequestUnreadTotalQueryOptions } from '@/features/quick-request/api/queries';
import { formatUnreadBadge } from '@/features/quick-request/components/chat/format-unread-badge';
import { useAssetPendingCount } from '@/features/asset-requests/hooks/use-asset-pending-count';
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

/** plan 103 AC-34 — 구독·비품 처리 대기 수 (권한자가 아니면 조회 안 함 · 0) */
function useAssetSubscriptionsPending(): number {
  return useAssetPendingCount('subscription');
}

function useAssetEquipmentPending(): number {
  return useAssetPendingCount('equipment');
}

/** 배지 훅 레지스트리 — `NavItem.badge` 키 → 숫자 훅 */
const NAV_BADGE_HOOKS: Record<NavBadgeKey, () => number> = {
  'quick-chat-unread': useQuickChatUnreadTotal,
  'asset-subscriptions-pending': useAssetSubscriptionsPending,
  'asset-equipment-pending': useAssetEquipmentPending
};

const NAV_BADGE_TEST_IDS: Record<NavBadgeKey, string> = {
  'quick-chat-unread': 'quick-chat-sidebar-badge',
  'asset-subscriptions-pending': 'nav-badge-subscriptions',
  'asset-equipment-pending': 'nav-badge-equipment'
};

/** 스크린리더 문구 — 키마다 뜻이 다르다 */
const NAV_BADGE_ARIA_LABELS: Record<NavBadgeKey, (count: number) => string> = {
  'quick-chat-unread': (count) => `안 읽은 대화 ${count}건`,
  'asset-subscriptions-pending': (count) => `처리 대기 ${count}건`,
  'asset-equipment-pending': (count) => `처리 대기 ${count}건`
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
      aria-label={NAV_BADGE_ARIA_LABELS[badgeKey](count)}
      className='rounded-full bg-primary px-1.5 text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground'
    >
      {formatUnreadBadge(count)}
    </SidebarMenuBadge>
  );
}
