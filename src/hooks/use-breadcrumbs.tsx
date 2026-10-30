'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { parseQuickDetailRequestNo } from '@/features/quick-request/lib/quick-mobile-routes';

type BreadcrumbItem = {
  title: string;
  link: string;
};

// This allows to add custom title as well
const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: 'Dashboard', link: '/dashboard' }],
  '/dashboard/employee': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Employee', link: '/dashboard/employee' }
  ],
  // plan 103 — 「자산 › 구독 관리」 · 「자산 › 비품 관리」
  '/dashboard/subscriptions': [
    { title: '자산', link: '/dashboard/subscriptions' },
    { title: '구독 관리', link: '/dashboard/subscriptions' }
  ],
  '/dashboard/equipment': [
    { title: '자산', link: '/dashboard/equipment' },
    { title: '비품 관리', link: '/dashboard/equipment' }
  ],
  // plan 106 D-2 — 퀵 화면 이름(휴대폰 상단바는 마지막 항목만 보인다 · 역할과 무관하게 「퀵 내역」)
  '/dashboard/quick': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: '퀵 내역', link: '/dashboard/quick' }
  ],
  '/dashboard/quick/request': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: '퀵 내역', link: '/dashboard/quick' },
    { title: '퀵 요청', link: '/dashboard/quick/request' }
  ],
  '/dashboard/quick/chat': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: '퀵 내역', link: '/dashboard/quick' },
    { title: '퀵 대화', link: '/dashboard/quick/chat' }
  ]
  // Add more custom mappings as needed
};

/** plan 106 D-2 — `/dashboard/quick/{번호}` → 「퀵 {번호}」 (번호 형식이 아니면 null → 기본 규칙) */
function resolveQuickDetailBreadcrumbs(pathname: string): BreadcrumbItem[] | null {
  const requestNo = parseQuickDetailRequestNo(pathname);
  if (!requestNo) return null;
  return [
    { title: 'Dashboard', link: '/dashboard' },
    { title: '퀵 내역', link: '/dashboard/quick' },
    { title: `퀵 ${requestNo}`, link: pathname }
  ];
}

export function useBreadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    // Check if we have a custom mapping for this exact path
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    const quickDetail = resolveQuickDetailBreadcrumbs(pathname);
    if (quickDetail) {
      return quickDetail;
    }

    // If no exact match, fall back to generating breadcrumbs from the path
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        title: segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname]);

  return breadcrumbs;
}
