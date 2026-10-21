import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { isWorkflowAdmin } from '@/features/auth/api/workflow-access.server';
import { countWorkflowDocuments } from '@/features/workflow/api/service.server';
import { parseWorkflowListQuery, workflowJson, workflowReadError } from '../../_utils';

/** 탭별 건수 — 현재 scope·q·writer·template·updated를 반영 (tab·group·sort·cursor 무시) */
export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  try {
    const admin = await isWorkflowAdmin(session.profile);
    const parsed = parseWorkflowListQuery(request.nextUrl.searchParams, { isWorkflowAdmin: admin });
    if (!parsed.ok) return workflowReadError(parsed.status, parsed.message);

    const counts = await countWorkflowDocuments(parsed.params);
    return workflowJson({ counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : '건수를 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}
