import type { Metadata } from 'next';
import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { hasMustChangeInitialPasswordCookie } from '@/lib/auth/must-change-cookie';
import { countMyContracts } from '@/features/contracts/api/service.server';
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
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  if (hasMustChangeInitialPasswordCookie(cookieStore)) {
    redirect('/auth/force-password-change');
  }

  const profile = await requireDashboardSession();
  const isAdmin = profile.system_role === 'admin';
  const hasMyContracts =
    !isAdmin && profile.full_name ? (await countMyContracts(profile.full_name)) >= 1 : false;

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
    <NavAccessProvider profile={profile} hasMyContracts={hasMyContracts}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <KBar>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar />
            <SidebarInset className='min-w-0'>
              <Header />
              <Suspense fallback={null}>
                <AccessDeniedToast />
              </Suspense>
              <ProfileStatusRealtime profile={profile} />
              <NotificationsRealtime profile={profile} />
              <InfobarProvider defaultOpen={false} className='min-w-0'>
                <div className='flex min-w-0 flex-1 flex-col'>{children}</div>
                <InfoSidebar side='right' />
              </InfobarProvider>
            </SidebarInset>
          </SidebarProvider>
        </KBar>
      </HydrationBoundary>
    </NavAccessProvider>
  );
}
