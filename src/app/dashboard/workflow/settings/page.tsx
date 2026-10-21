import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { requireWorkflowAdminPage } from '@/features/auth/api/session.server';
import {
  workflowAdminsQueryOptions,
  workflowTemplateQueryOptions,
  workflowTemplatesQueryOptions
} from '@/features/workflow/api/queries';
import {
  getWorkflowTemplateDetail,
  listWorkflowAdmins,
  listWorkflowTemplates
} from '@/features/workflow/api/service.server';
import { WorkflowSettingsPage } from '@/features/workflow/components/workflow-settings-page';
import { getQueryClient } from '@/lib/query-client';

export default async function WorkflowSettingsRoute() {
  // 미권한 → /dashboard/workflow redirect (접근 거부 flash) — middleware·proxy가 먼저 막는다
  const profile = await requireWorkflowAdminPage();
  const isSystemAdmin = profile.system_role === 'admin';

  // 카드 데이터를 서버에서 미리 조회한다 (클라이언트 Suspense가 캐시를 이어받음)
  const queryClient = getQueryClient();
  const templates = await queryClient
    .fetchQuery({ ...workflowTemplatesQueryOptions(), queryFn: listWorkflowTemplates })
    .catch(() => null);
  await Promise.all([
    isSystemAdmin
      ? queryClient.prefetchQuery({ ...workflowAdminsQueryOptions(), queryFn: listWorkflowAdmins })
      : Promise.resolve(),
    ...(templates ?? []).map((template) =>
      queryClient.prefetchQuery({
        ...workflowTemplateQueryOptions(template.template_key),
        queryFn: async () => {
          const detail = await getWorkflowTemplateDetail(template.template_key);
          if (!detail) throw new Error('양식을 찾을 수 없습니다.');
          return detail;
        }
      })
    )
  ]);

  return (
    <PageContainer
      pageTitle='워크플로우 설정'
      pageDescription='워크플로우 관리자와 양식별 기본 결재선을 관리합니다.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <WorkflowSettingsPage isSystemAdmin={isSystemAdmin} />
      </HydrationBoundary>
    </PageContainer>
  );
}
