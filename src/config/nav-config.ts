import { NavGroup } from "@/types";

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 * Items are organized into groups, each rendered with a SidebarGroupLabel.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on Supabase `profiles.system_role` (client-side UX only).
 *
 * Example — admin-only Users:
 *    access: { systemRole: 'admin' }
 */
export const navGroups: NavGroup[] = [
  {
    label: "Overview (개요)",
    items: [
      {
        title: "대시보드",
        url: "/dashboard/overview",
        icon: "dashboard",
        isActive: false,
        shortcut: ["d", "d"],
        items: [],
      },
      {
        title: "공지사항",
        url: "/dashboard/announcements",
        icon: "post",
        shortcut: ["a", "n"],
        isActive: false,
        items: [],
      },
      {
        title: "조직도",
        url: "/dashboard/org-chart",
        icon: "teams",
        shortcut: ["o", "r"],
        isActive: false,
        items: [],
      },
      {
        title: "칸반",
        url: "/dashboard/kanban",
        icon: "kanban",
        shortcut: ["k", "b"],
        isActive: false,
        items: [],
      },
    ],
  },
  {
    label: '퀵',
    items: [
      {
        title: '퀵 요청하기',
        url: '/dashboard/quick/request',
        icon: 'send',
        shortcut: ['q', 'r'],
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: '워크플로우',
    items: [
      {
        title: '문서함',
        url: '/dashboard/workflow',
        icon: 'clipboardText',
        shortcut: ['w', 'f'],
        isActive: false,
        items: []
      },
      {
        title: '워크플로우 설정',
        url: '/dashboard/workflow/settings',
        icon: 'settings',
        shortcut: ['w', 's'],
        isActive: false,
        access: { hasWorkflowAdminNav: true },
        items: []
      }
    ]
  },
  {
    label: 'HR (인사)',
    items: [
      {
        title: '복지비 관리',
        url: '/dashboard/benefits',
        icon: 'wallet',
        shortcut: ['b', 'h'],
        isActive: false,
        access: { hasHrBenefitsNav: true },
        items: []
      }
    ]
  },
  {
    label: "Admin (관리)",
    items: [
      {
        title: "사용자 관리",
        url: "/dashboard/users",
        icon: "teams",
        shortcut: ["u", "u"],
        isActive: false,
        access: { systemRole: "admin" },
        items: [],
      },
      {
        title: "계약서 관리",
        url: "/dashboard/contracts",
        icon: "forms",
        shortcut: ["c", "t"],
        isActive: false,
        access: { systemRole: "admin" },
        items: [
          {
            title: "독촉 이메일 로그",
            url: "/dashboard/system-email-logs",
            icon: "send",
            shortcut: ["e", "l"],
          },
        ],
      },
      {
        title: "복지비 관리",
        url: "/dashboard/benefits",
        icon: "wallet",
        shortcut: ["b", "m"],
        isActive: false,
        access: { systemRole: "admin" },
        items: [],
      },
      {
        title: "CS 문의",
        url: "/dashboard/support",
        icon: "help",
        shortcut: ["c", "s"],
        isActive: false,
        access: { systemRole: "admin" },
        items: [],
      },
    ],
  },
  {
    label: "Account (계정)",
    items: [
      {
        title: "프로필",
        url: "/dashboard/profile",
        icon: "profile",
        shortcut: ["p", "r"],
        isActive: false,
        items: [],
      },
      {
        title: "내 계약서",
        url: "/dashboard/my-contracts",
        icon: "page",
        shortcut: ["m", "c"],
        isActive: false,
        access: { hasMyContracts: true },
        items: [],
      },
      {
        title: "내 복지비",
        url: "/dashboard/my-benefits",
        icon: "wallet",
        shortcut: ["m", "b"],
        isActive: false,
        items: [],
      },
      {
        title: "식대 카드",
        url: "/dashboard/wallet",
        icon: "wallet",
        shortcut: ["w", "l"],
        isActive: false,
        items: [
          {
            title: "잔액 확인 이메일 로그",
            url: "/dashboard/wallet/balance-email-logs",
            icon: "send",
            access: { systemRole: "admin" },
          },
        ],
      },
      {
        title: "알림",
        url: "/dashboard/notifications",
        icon: "notification",
        shortcut: ["n", "t"],
        isActive: false,
        items: [],
      },
      {
        title: "CS 문의",
        url: "/dashboard/support",
        icon: "help",
        shortcut: ["c", "s"],
        isActive: false,
        access: { systemRole: "user" },
        items: [],
      },
      {
        title: "활동 로그",
        url: "/dashboard/logs",
        icon: "forms",
        shortcut: ["l", "g"],
        isActive: false,
        items: [],
      },
    ],
  },
];
