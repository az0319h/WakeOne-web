import { requireSession } from '@/features/auth/api/session.server';
import { listActiveMembers } from '@/features/workflow/api/service.server';
import { workflowJson, workflowReadError } from '../_utils';

/** active 구성원 (결재선·작성자 필터 Combobox) — 이름·이메일·소속·직급·아바타 */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) return session.response;

  try {
    const members = await listActiveMembers();
    return workflowJson({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : '구성원을 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}
