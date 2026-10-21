import { createLoader, type SearchParams } from 'nuqs/server';
import PageContainer from '@/components/layout/page-container';
import { requireDashboardSession } from '@/features/auth/api/session.server';
import { isWorkflowAdmin } from '@/features/auth/api/workflow-access.server';
import { WorkflowComposeButton } from '@/features/workflow/components/workflow-compose-button';
import { WorkflowComposeProvider } from '@/features/workflow/components/workflow-compose-context';
import { WorkflowPage } from '@/features/workflow/components/workflow-page';
import { workflowSearchParsers } from '@/features/workflow/lib/search-params';

type PageProps = {
  searchParams: Promise<SearchParams>;
};

const loadWorkflowSearchParams = createLoader(workflowSearchParsers);

/**
 * 문서함 — 목록 데이터는 클라이언트가 `/api/workflow/documents`(사용자 세션 RLS)로 읽는다.
 * 서버 prefetch를 하지 않는 이유: 목록 API 실패(AC-45)를 화면 안 오류 안내로 보여 주고,
 * 필터 셸(툴바)은 Suspense 밖에서 먼저 그린다(plan 40).
 */
export default async function WorkflowInboxPage(props: PageProps) {
  const profile = await requireDashboardSession();
  const admin = await isWorkflowAdmin(profile).catch(() => false);
  // searchParams 형식 검증만 (정규화는 클라이언트 훅과 같은 lib/search-params)
  loadWorkflowSearchParams(await props.searchParams);

  return (
    <WorkflowComposeProvider>
      <PageContainer
        pageTitle='문서함'
        pageDescription='내가 작성하거나 승인·참조하는 문서를 확인합니다.'
        pageHeaderAction={<WorkflowComposeButton />}
      >
        <WorkflowPage isWorkflowAdmin={admin} />
      </PageContainer>
    </WorkflowComposeProvider>
  );
}
