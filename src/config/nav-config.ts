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
    label: '개요',
    items: [
      {
        title: '대시보드',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: '비품 대장',
        url: '/dashboard/product',
        icon: 'product',
        shortcut: ['p', 'p'],
        isActive: false,
        access: { assetLedger: true },
        items: []
      },
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
        items: []
      }
    ]
  },
  {
    label: '',
    items: [
      {
        title: '계정',
        url: '#',
        icon: 'account',
        isActive: true,
        items: [
          {
            title: '프로필',
            url: '/dashboard/profile',
            icon: 'profile',
            shortcut: ['p', 'r']
          },
          {
            title: '활동 로그',
            url: '/dashboard/logs',
            icon: 'forms',
            shortcut: ['l', 'g']
          }
        ]
      }
    ]
  }
];
