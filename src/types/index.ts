import { Icons } from '@/components/icons';

export type SystemRole = 'admin' | 'user';

export interface PermissionCheck {
  /** Supabase `profiles.system_role` — navigation visibility (UX only). */
  systemRole?: SystemRole;
  /** 웨이크 소속 또는 admin만 노출 (사무실 간식). */
  officeSnacks?: boolean;
  /** 웨이크 소속 또는 admin만 노출 (비품 대장). */
  assetLedger?: boolean;
  /** @deprecated Clerk-era fields — ignored by `checkNavAccess`. */
  permission?: string;
  plan?: string;
  feature?: string;
  role?: string;
  requireOrg?: boolean;
}

export interface NavItem {
  title: string;
  url: string;
  disabled?: boolean;
  external?: boolean;
  shortcut?: [string, string];
  icon?: keyof typeof Icons;
  label?: string;
  description?: string;
  isActive?: boolean;
  items?: NavItem[];
  access?: PermissionCheck;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface NavItemWithOptionalChildren extends NavItem {
  items?: NavItemWithChildren[];
}

export interface FooterItem {
  title: string;
  items: {
    title: string;
    href: string;
    external?: boolean;
  }[];
}

export type MainNavItem = NavItemWithOptionalChildren;

export type SidebarNavItem = NavItemWithChildren;
