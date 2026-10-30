'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { quickRequestUnreadTotalQueryOptions } from '../../api/queries';
import {
  isQuickTabPagePath,
  QUICK_CHAT_PATH,
  QUICK_LIST_PATH,
  QUICK_REQUEST_FORM_PATH
} from '../../lib/quick-mobile-routes';
import { formatUnreadBadge } from '../chat/format-unread-badge';
import { QUICK_MOBILE_TEXT, quickMobileUnreadSrText } from './quick-mobile-constants';

type QuickMobileTabbarProps = {
  /** 「요청하기」 탭 노출 — `buildQuickRequestViewer(profile).canCreate` (동방특송 false → 탭 2개) */
  canCreate: boolean;
};

const TAB_LINK_CLASS_NAME =
  'relative flex h-14 w-full touch-manipulation flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:text-primary';

/**
 * plan 106 D-4 · U-1 · designer §2.7 — 퀵 전용 하단 탭 바 (lg 미만).
 * - 내역·대화 목록에서만 보인다. 요청 폼·상세·대화방(`?request=`)에서는 그리지 않는다
 *   (상세 대화 `?chat=1`·대화방은 전역 CSS `data-quick-fullscreen` 규칙도 함께 숨긴다).
 * - 문서 흐름 끝의 `sticky bottom-0`(fixed 아님 · K3) — 사이드바와 겹치지 않고 본문이 항상 탭 바 위에서 끝난다.
 * - 「대화」 배지는 사이드바 「퀵 대화」와 같은 `quickRequestUnreadTotalQueryOptions` (Realtime·markRead가 같은 캐시를 갱신).
 */
export function QuickMobileTabbar({ canCreate }: QuickMobileTabbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!isQuickTabPagePath(pathname)) return null;
  if (pathname === QUICK_CHAT_PATH && searchParams.get('request')) return null;

  const isListActive = pathname === QUICK_LIST_PATH;
  const isChatActive = pathname === QUICK_CHAT_PATH;

  return (
    <nav
      aria-label={QUICK_MOBILE_TEXT.tabbarLabel}
      data-testid='quick-mobile-tabbar'
      data-quick-tabbar=''
      data-quick-sticky-bottom=''
      className='bg-background/80 sticky bottom-0 z-30 mt-auto border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden'
    >
      <ul className={cn('grid', canCreate ? 'grid-cols-3' : 'grid-cols-2')}>
        <li className='flex'>
          <Link
            href={QUICK_LIST_PATH}
            aria-current={isListActive ? 'page' : undefined}
            data-testid='quick-mobile-tab-list'
            className={TAB_LINK_CLASS_NAME}
          >
            <Icons.list aria-hidden className='size-6' />
            <span data-slot='label'>{QUICK_MOBILE_TEXT.tabList}</span>
          </Link>
        </li>
        <li className='flex'>
          <QuickMobileChatTab isActive={isChatActive} />
        </li>
        {canCreate ? (
          <li className='flex'>
            <Link
              href={QUICK_REQUEST_FORM_PATH}
              data-testid='quick-mobile-tab-request'
              className={TAB_LINK_CLASS_NAME}
            >
              <span className='bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full'>
                <Icons.add aria-hidden className='size-5' />
              </span>
              <span data-slot='label'>{QUICK_MOBILE_TEXT.tabRequest}</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

type QuickMobileChatTabProps = {
  isActive: boolean;
};

/** 「대화」 탭 — 배지(99+)는 사이드바와 같은 non-suspense 조회라 Suspense 경계 없이 안전 (nav-badges.tsx 선례) */
function QuickMobileChatTab({ isActive }: QuickMobileChatTabProps) {
  const { data } = useQuery(quickRequestUnreadTotalQueryOptions());
  const unread = data ?? 0;

  return (
    <Link
      href={QUICK_CHAT_PATH}
      aria-current={isActive ? 'page' : undefined}
      data-testid='quick-mobile-tab-chat'
      className={TAB_LINK_CLASS_NAME}
    >
      <span className='relative'>
        <Icons.chat aria-hidden className='size-6' />
        {unread > 0 ? (
          <span
            aria-hidden
            data-testid='quick-mobile-tab-chat-badge'
            className='bg-primary text-primary-foreground absolute -top-1.5 left-4 min-w-5 rounded-full px-1.5 text-center text-xs leading-5 tabular-nums'
          >
            {formatUnreadBadge(unread)}
          </span>
        ) : null}
      </span>
      <span data-slot='label'>{QUICK_MOBILE_TEXT.tabChat}</span>
      {unread > 0 ? <span className='sr-only'>{quickMobileUnreadSrText(unread)}</span> : null}
    </Link>
  );
}
