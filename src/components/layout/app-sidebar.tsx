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

function isPathActive(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`);
}

function isNavItemActive(pathname: string, item: NavItem) {
  const childActive = item.items?.some((subItem) => isPathActive(pathname, subItem.url)) ?? false;
  return isPathActive(pathname, item.url) || childActive;
}

function isNavItemOpen(pathname: string, item: NavItem) {
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
  const routeOpen = isNavItemOpen(pathname, item);
  const [open, setOpen] = React.useState(routeOpen);
  const prevPathnameRef = React.useRef(pathname);
  const Icon = item.icon ? Icons[item.icon] : Icons.logo;
  const isActive = isNavItemActive(pathname, item);

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
  const Icon = item.icon ? Icons[item.icon] : Icons.logo;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} isActive={isPathActive(pathname, item.url)}>
        <Link href={item.url}>
          <Icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppSidebar() {
  const pathname = usePathname();
  const { isOpen } = useMediaQuery();
  const profile = useNavAccess();
  const filteredGroups = useFilteredNavGroups(navGroups);

  React.useEffect(() => {
    // Side effects based on sidebar state changes
  }, [isOpen]);

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader />
      <SidebarContent className='overflow-x-hidden'>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label || 'ungrouped'}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
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
      <SidebarFooter>{profile ? <NavUser profile={profile} /> : null}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export default AppSidebar;
