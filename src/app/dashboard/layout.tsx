import type { Metadata } from "next";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import { InfoSidebar } from "@/components/layout/info-sidebar";
import { InfobarProvider } from "@/components/ui/infobar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { isWakeHrBenefitsManager } from "@/features/auth/api/benefits-access.server";
import { isWorkflowAdmin } from "@/features/auth/api/workflow-access.server";
import { isAssetManager } from "@/features/auth/api/asset-access.server";
import { requireDashboardSession } from "@/features/auth/api/session.server";
import { countMyContracts } from "@/features/contracts/api/service.server";
import { NavAccessProvider } from "@/contexts/nav-access";
import { AccessDeniedToast } from "@/components/dashboard/access-denied-toast";
import { ProfileStatusRealtime } from "@/features/auth/components/profile-status-realtime";
import { NotificationsRealtime } from "@/features/notifications/components/notifications-realtime";
import { QuickChatUnreadRealtime } from "@/features/quick-request/components/chat/quick-chat-unread-realtime";
import { canViewAllQuickRequests } from "@/features/auth/api/quick-access.server";
import { resolveQuickScopeTopic } from "@/features/quick-request/lib/quick-realtime-topics";
import { IosInstallBanner } from "@/features/notifications/components/ios-install-banner";
import { PushResumeSync } from "@/features/notifications/components/push-resume-sync";
import { AppBadgeSync } from "@/features/notifications/components/app-badge-sync";
import { AttachmentLightboxProvider } from "@/features/attachments/components/attachment-lightbox-provider";
import { DashboardPresenceTrack } from "@/features/live-users/components/dashboard-presence-track";
import {
  NOTIFICATIONS_PAGE_SIZE,
  notificationsInfiniteQueryOptions,
} from "@/features/notifications/api/queries";
import { listNotifications } from "@/features/notifications/api/service.server";
import { getQueryClient } from "@/lib/query-client";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  const profile = await requireDashboardSession();
  const isAdmin = profile.system_role === "admin";
  const hasMyContracts =
    !isAdmin && profile.full_name
      ? (await countMyContracts(profile.full_name)) >= 1
      : false;
  const hasHrBenefitsNav = isWakeHrBenefitsManager(profile);
  const hasWorkflowAdminNav = await isWorkflowAdmin(profile).catch(
    () => false,
  );
  // plan 103 — 구독·비품 처리 대기 배지 (권한자만)
  const hasAssetManagerNav = isAssetManager(profile);

  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  const queryClient = getQueryClient();

  void queryClient.prefetchInfiniteQuery({
    ...notificationsInfiniteQueryOptions(),
    queryFn: ({ pageParam }) =>
      listNotifications(profile.user_id, isAdmin, {
        limit: NOTIFICATIONS_PAGE_SIZE,
        cursor: pageParam,
      }),
  });

  return (
    <NavAccessProvider
      profile={profile}
      hasMyContracts={hasMyContracts}
      hasHrBenefitsNav={hasHrBenefitsNav}
      hasWorkflowAdminNav={hasWorkflowAdminNav}
      isAssetManager={hasAssetManagerNav}
    >
      <DashboardPresenceTrack profile={profile}>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AttachmentLightboxProvider>
            <KBar>
              <SidebarProvider defaultOpen={defaultOpen}>
                <AppSidebar />
                <SidebarInset className="min-w-0">
                  <Header />
                  <Suspense fallback={null}>
                    <AccessDeniedToast />
                  </Suspense>
                  <ProfileStatusRealtime profile={profile} />
                  <NotificationsRealtime profile={profile} />
                  <QuickChatUnreadRealtime
                    profile={profile}
                    topic={resolveQuickScopeTopic({
                      scope: canViewAllQuickRequests(profile) ? "all" : "own",
                      userId: profile.user_id,
                    })}
                  />
                  <Suspense fallback={null}>
                    <AppBadgeSync />
                  </Suspense>
                  {/* plan 106 K16 — 퀵 전체 화면 대화(`data-quick-fullscreen`)에서 전역 CSS가 배너 묶음을 숨긴다 (배너 컴포넌트 불변 · contents라 레이아웃 영향 0) */}
                  <div data-app-banner className="contents">
                    <IosInstallBanner />
                    <PushResumeSync userId={profile.user_id} />
                  </div>
                  <InfobarProvider defaultOpen={false} className="min-w-0">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                      {children}
                    </div>
                    <InfoSidebar side="right" />
                  </InfobarProvider>
                </SidebarInset>
              </SidebarProvider>
            </KBar>
          </AttachmentLightboxProvider>
        </HydrationBoundary>
      </DashboardPresenceTrack>
    </NavAccessProvider>
  );
}
