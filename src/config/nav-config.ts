import { NavGroup } from '@/types';

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
    label: 'Overview (개요)',
    items: [
      {
        title: '대시보드',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      }
    ]
  },
  {
    label: 'Admin (관리)',
    items: [
      {
        title: '사용자 관리',
        url: '/dashboard/users',
        icon: 'teams',
        shortcut: ['u', 'u'],
        isActive: false,
        access: { systemRole: 'admin' },
        items: []
      },
      {
        title: '계약서 관리',
        url: '/dashboard/contracts',
        icon: 'forms',
        shortcut: ['c', 't'],
        isActive: false,
        access: { systemRole: 'admin' },
        items: [
          {
            title: '독촉 이메일 로그',
            url: '/dashboard/system-email-logs',
            icon: 'send',
            shortcut: ['e', 'l']
          }
        ]
      }
    ]
  },
  {
    label: 'Account (계정)',
    items: [
      {
        title: '프로필',
        url: '/dashboard/profile',
        icon: 'profile',
        shortcut: ['p', 'r'],
        isActive: false,
        items: []
      },
      {
        title: '지갑',
        url: '/dashboard/wallet',
        icon: 'wallet',
        shortcut: ['w', 'l'],
        isActive: false,
        items: []
      },
      {
        title: '알림',
        url: '/dashboard/notifications',
        icon: 'notification',
        shortcut: ['n', 't'],
        isActive: false,
        items: []
      },
      {
        title: '활동 로그',
        url: '/dashboard/logs',
        icon: 'forms',
        shortcut: ['l', 'g'],
        isActive: false,
        items: []
      }
    ]
  }
];
