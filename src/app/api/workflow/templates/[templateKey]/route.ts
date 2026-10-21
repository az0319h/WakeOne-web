import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { getWorkflowTemplateDetail } from '@/features/workflow/api/service.server';
import { workflowJson, workflowReadError } from '../../_utils';

type Params = { params: Promise<{ templateKey: string }> };

/** 양식 상세 — 필드 정의(required·required_when·options·prefill) + 가이드 + 기본 결재선(구성원 표시 정보 포함) */
export async function GET(_request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { templateKey } = await params;
  try {
    const template = await getWorkflowTemplateDetail(templateKey);
    if (!template) return workflowReadError(404, '양식을 찾을 수 없습니다.');
    return workflowJson({ template });
  } catch (error) {
    const message = error instanceof Error ? error.message : '양식을 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}
