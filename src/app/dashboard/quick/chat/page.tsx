import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { buildQuickRequestViewer } from '@/features/quick-request/api/workflow.server';
import { QuickChatMessenger } from '@/features/quick-request/components/chat/quick-chat-messenger';
import {
  QUICK_CHAT_PAGE_DESCRIPTION,
  QUICK_CHAT_PAGE_TITLE
} from '@/features/quick-request/components/chat/quick-chat-constants';
import { quickInfoContent } from '@/features/quick-request/info-content';
import { resolveQuickScopeTopic } from '@/features/quick-request/lib/quick-realtime-topics';
import { searchParamsCache } from '@/lib/searchparams';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

/** plan 93 — 「퀵 대화」 Messenger. 목록·대화는 클라이언트에서 조회한다(서버 prefetch 없음 · 퀵 대시보드와 같음) */
export default async function QuickChatRoute(props: PageProps) {
  const profile = await requireDashboardSession();
  searchParamsCache.parse(await props.searchParams);
  const viewer = buildQuickRequestViewer(profile);
  const realtimeTopic = resolveQuickScopeTopic({ scope: viewer.scope, userId: profile.user_id });

  return (
    <PageContainer
      viewportFill
      pageTitle={QUICK_CHAT_PAGE_TITLE}
      pageDescription={QUICK_CHAT_PAGE_DESCRIPTION}
      infoContent={quickInfoContent}
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <QuickChatMessenger realtimeTopic={realtimeTopic} />
      </Suspense>
    </PageContainer>
  );
}
