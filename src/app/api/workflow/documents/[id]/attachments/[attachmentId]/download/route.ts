import { NextRequest } from 'next/server';
import { requireSession } from '@/features/auth/api/session.server';
import { createWorkflowAttachmentDownload } from '@/features/workflow/api/service.server';
import { isUuid } from '@/features/workflow/api/validators';
import { workflowJson, workflowReadError } from '../../../../../_utils';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

const NOT_FOUND = '첨부파일을 찾을 수 없습니다.';

/**
 * 첨부 다운로드 — 열람자(RLS)만 60초 signed URL `{ url }`을 받는다.
 * `?download=1`이면 Content-Disposition attachment(파일명)로 서명한다(lightbox blob용은 생략).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const { id, attachmentId } = await params;
  if (!isUuid(id) || !isUuid(attachmentId)) return workflowReadError(404, NOT_FOUND);

  try {
    const download = request.nextUrl.searchParams.get('download') === '1';
    const result = await createWorkflowAttachmentDownload({ documentId: id, attachmentId, download });
    if (!result) return workflowReadError(404, NOT_FOUND);
    return workflowJson(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '첨부파일을 불러오지 못했습니다.';
    return workflowReadError(500, message);
  }
}
