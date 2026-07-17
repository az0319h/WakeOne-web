import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { NavAccessProvider } from '@/contexts/nav-access';
import { AccessDeniedToast } from '@/components/dashboard/access-denied-toast';
import { ProfileStatusRealtime } from '@/features/auth/components/profile-status-realtime';
import { NotificationsRealtime } from '@/features/notifications/components/notifications-realtime';
import {
  NOTIFICATIONS_PAGE_SIZE,
  notificationsInfiniteQueryOptions
} from '@/features/notifications/api/queries';
import { listNotifications } from '@/features/notifications/api/service.server';
import { getQueryClient } from '@/lib/query-client';

export const metadata: Metadata = {
  title: 'Next Shadcn Dashboard Starter',
  description: 'Basic dashboard with Next.js and Shadcn',
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireDashboardSession();
  const isAdmin = profile.system_role === 'admin';

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';

  const queryClient = getQueryClient();

  void queryClient.prefetchInfiniteQuery({
    ...notificationsInfiniteQueryOptions(),
    queryFn: ({ pageParam }) =>
      listNotifications(profile.user_id, isAdmin, {
        limit: NOTIFICATIONS_PAGE_SIZE,
        cursor: pageParam
      })
  });

  return (
    <NavAccessProvider profile={profile}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <KBar>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar />
            <SidebarInset>
              <Header />
              <Suspense fallback={null}>
                <AccessDeniedToast />
              </Suspense>
              <ProfileStatusRealtime profile={profile} />
              <NotificationsRealtime profile={profile} />
              <InfobarProvider defaultOpen={false}>
                {children}
                <InfoSidebar side='right' />
              </InfobarProvider>
            </SidebarInset>
          </SidebarProvider>
        </KBar>
      </HydrationBoundary>
    </NavAccessProvider>
  );
}
