import { Suspense } from 'react';
import type { SearchParams } from 'nuqs/server';
import PageContainer from '@/components/layout/page-container';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { QuickChatMessenger } from '@/features/quick-request/components/chat/quick-chat-messenger';
import {
  QUICK_CHAT_PAGE_DESCRIPTION,
  QUICK_CHAT_PAGE_TITLE
} from '@/features/quick-request/components/chat/quick-chat-constants';
import { quickInfoContent } from '@/features/quick-request/info-content';
import { searchParamsCache } from '@/lib/searchparams';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

/** plan 93 — 「퀵 대화」 Messenger. 목록·대화는 클라이언트에서 조회한다(서버 prefetch 없음 · 퀵 대시보드와 같음) */
export default async function QuickChatRoute(props: PageProps) {
  await requireDashboardSession();
  searchParamsCache.parse(await props.searchParams);

  return (
    <PageContainer
      viewportFill
      pageTitle={QUICK_CHAT_PAGE_TITLE}
      pageDescription={QUICK_CHAT_PAGE_DESCRIPTION}
      infoContent={quickInfoContent}
    >
      <Suspense fallback={<PageLoadingSpinner variant='fill' />}>
        <QuickChatMessenger />
      </Suspense>
    </PageContainer>
  );
}
