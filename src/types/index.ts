import { Icons } from "@/components/icons";

export type SystemRole = "admin" | "user";

export interface PermissionCheck {
  /** Supabase `profiles.system_role` — navigation visibility (UX only). */
  systemRole?: SystemRole;
  /** 매칭 active 계약 ≥1 — 「내 계약서」 nav (UX only, 서버 가드 별도). */
  hasMyContracts?: boolean;
  /** wake 인사팀(user) — 「복지비 관리」 HR nav (UX only, 서버 가드 별도). */
  hasHrBenefitsNav?: boolean;
  /** 워크플로우 관리자(시스템 관리자 포함) — 「워크플로우 설정」 nav (UX only, 서버 가드 별도). */
  hasWorkflowAdminNav?: boolean;
  /** @deprecated Clerk-era fields — ignored by `checkNavAccess`. */
  permission?: string;
  plan?: string;
  feature?: string;
  role?: string;
  requireOrg?: boolean;
}

/** plan 93 — 사이드바 배지 레지스트리 키 (`src/components/layout/nav-badges.tsx`) */
export type NavBadgeKey = 'quick-chat-unread';

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
  /** plan 93 — 메뉴 오른쪽 숫자 배지 (사이드바 전용 · kbar 미표시) */
  badge?: NavBadgeKey;
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
