import { requireSession } from '@/features/auth/api/session.server';
import { listWorkflowTemplates } from '@/features/workflow/api/service.server';
import { workflowJson, workflowReadError } from '../_utils';

/** 작성 가능한 양식 목록 (RLS: 관리자 전용 양식은 워크플로우 관리자에게만) */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) return session.response;

  try {
    const templates = await listWorkflowTemplates();
    return workflowJson({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : '양식을 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}
