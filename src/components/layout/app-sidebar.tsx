'use client';

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { navGroups } from '@/config/nav-config';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { useNavAccess } from '@/contexts/nav-access';
import type { NavItem } from '@/types';
import { NavUser } from '../nav-user';
import { Icons } from '../icons';
import { NavItemBadge } from './nav-badges';

function matchesPath(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * plan 89 K10 — 가장 긴 URL 일치만 활성.
 * `/dashboard/quick/request`에서 「퀵 대시보드」(`/dashboard/quick`)와 「퀵 요청하기」가 동시에 켜지지 않게 한다.
 */
function collectNavUrls(groups: { items: NavItem[] }[]): string[] {
  const urls: string[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      urls.push(item.url);
      for (const sub of item.items ?? []) {
        urls.push(sub.url);
      }
    }
  }
  return urls;
}

const NavActiveUrlContext = React.createContext<string | null>(null);

function resolveActiveNavUrl(pathname: string, urls: string[]): string | null {
  let best: string | null = null;
  for (const url of urls) {
    if (url !== '#' && matchesPath(pathname, url) && (best === null || url.length > best.length)) {
      best = url;
    }
  }
  return best;
}

function useIsPathActive() {
  const activeUrl = React.use(NavActiveUrlContext);
  return React.useCallback((_pathname: string, url: string) => activeUrl === url, [activeUrl]);
}

function isNavItemActive(
  pathname: string,
  item: NavItem,
  isPathActive: (pathname: string, url: string) => boolean
) {
  const childActive = item.items?.some((subItem) => isPathActive(pathname, subItem.url)) ?? false;
  return isPathActive(pathname, item.url) || childActive;
}

function isNavItemOpen(
  pathname: string,
  item: NavItem,
  isPathActive: (pathname: string, url: string) => boolean
) {
  if (isPathActive(pathname, item.url)) {
    return true;
  }

  return item.items?.some((subItem) => isPathActive(pathname, subItem.url)) ?? false;
}

interface SidebarNavCollapsibleItemProps {
  item: NavItem;
  pathname: string;
}

function SidebarNavCollapsibleItem({ item, pathname }: SidebarNavCollapsibleItemProps) {
  const isPathActive = useIsPathActive();
  const routeOpen = isNavItemOpen(pathname, item, isPathActive);
  const [open, setOpen] = React.useState(routeOpen);
  const prevPathnameRef = React.useRef(pathname);
  const Icon = item.icon ? Icons[item.icon] : Icons.logo;
  const isActive = isNavItemActive(pathname, item, isPathActive);

  React.useEffect(() => {
    if (pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = pathname;
      setOpen(routeOpen);
    }
  }, [pathname, routeOpen]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild className='group/collapsible'>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={item.title} isActive={isActive} asChild>
          <Link
            href={item.url}
            onClick={() => {
              setOpen((current) => !current);
            }}
          >
            {item.icon && <Icon />}
            <span>{item.title}</span>
            <Icons.chevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
          </Link>
        </SidebarMenuButton>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton asChild isActive={isPathActive(pathname, subItem.url)}>
                  <Link href={subItem.url}>
                    <span>{subItem.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

interface SidebarNavLeafItemProps {
  item: NavItem;
  pathname: string;
}

function SidebarNavLeafItem({ item, pathname }: SidebarNavLeafItemProps) {
  const isPathActive = useIsPathActive();
  const Icon = item.icon ? Icons[item.icon] : Icons.logo;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} isActive={isPathActive(pathname, item.url)}>
        <Link href={item.url}>
          <Icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {/* plan 93 — 배지는 Link 밖 형제 (`SidebarMenuBadge` · 접힘 모드 숨김 내장) */}
      {item.badge ? <NavItemBadge badgeKey={item.badge} /> : null}
    </SidebarMenuItem>
  );
}

function AppSidebar() {
  const pathname = usePathname();
  const { isOpen } = useMediaQuery();
  const profile = useNavAccess();
  const filteredGroups = useFilteredNavGroups(navGroups);
  const activeUrl = resolveActiveNavUrl(pathname, collectNavUrls(filteredGroups));

  React.useEffect(() => {
    // Side effects based on sidebar state changes
  }, [isOpen]);

  return (
    <NavActiveUrlContext value={activeUrl}>
    <Sidebar collapsible='icon'>
      <SidebarHeader />
      <SidebarContent className='overflow-x-hidden'>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label || 'ungrouped'}>
            {group.label && (
              // 접힘(icon) 모드에서 label이 -mt-8 · opacity-0로 이전 그룹 마지막 항목(예: 「퀵 요청하기」)을 덮어 클릭을 가로채지 않게 한다
              <SidebarGroupLabel className='group-data-[collapsible=icon]:pointer-events-none'>
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {group.items.map((item) =>
                item.items && item.items.length > 0 ? (
                  <SidebarNavCollapsibleItem key={item.title} item={item} pathname={pathname} />
                ) : (
                  <SidebarNavLeafItem key={item.title} item={item} pathname={pathname} />
                )
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {/* plan 106 D-3 — viewport-fit=cover: 휴대폰 사이드바(Sheet p-0) 맨 아래 사용자 메뉴가 홈 막대에 겹치지 않게 (PC env 0 → p-2 그대로) */}
      <SidebarFooter className='pb-[max(0.5rem,env(safe-area-inset-bottom))]'>
        {profile ? <NavUser profile={profile} /> : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    </NavActiveUrlContext>
  );
}

export default AppSidebar;
