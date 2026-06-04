import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { getSessionProfile } from '@/features/auth/api/session.server';
import { NavAccessProvider } from '@/contexts/nav-access';
import { AccessDeniedToast } from '@/components/dashboard/access-denied-toast';

export const metadata: Metadata = {
  title: 'Next Shadcn Dashboard Starter',
  description: 'Basic dashboard with Next.js and Shadcn',
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  const profile = await getSessionProfile();

  return (
    <NavAccessProvider profile={profile}>
      <KBar>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset>
            <Header />
            <Suspense fallback={null}>
              <AccessDeniedToast />
            </Suspense>
            <InfobarProvider defaultOpen={false}>
              {children}
              <InfoSidebar side='right' />
            </InfobarProvider>
          </SidebarInset>
        </SidebarProvider>
      </KBar>
    </NavAccessProvider>
  );
}
