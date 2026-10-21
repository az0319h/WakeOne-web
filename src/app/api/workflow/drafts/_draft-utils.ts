import { prepareWorkflowContent } from '@/features/workflow/api/document-input.server';
import type { WorkflowTemplateDefinition } from '@/features/workflow/api/service.server';
import type { WorkflowDraftPayload } from '@/features/workflow/api/types';
import { asRecord, parseApprovalLineBody, parseUuidArray } from '@/features/workflow/api/validators';
import { normalizeWorkflowValues } from '@/features/workflow/lib/inputs';

const DRAFT_MAX_JSON_LENGTH = 400_000;

/** 임시저장 payload 정규화 — 필수 검증 없음(작성 중 상태), 구조·크기·본문 정화만 */
export function parseDraftBody(
  body: Record<string, unknown>,
  template: WorkflowTemplateDefinition
): { ok: true; payload: WorkflowDraftPayload; attachmentIds: string[] } | { ok: false; message: string } {
  const raw = asRecord(body.payload) ?? {};
  const line = parseApprovalLineBody(raw);
  if (!line) return { ok: false, message: '결재선 형식이 올바르지 않습니다.' };

  const content = prepareWorkflowContent(raw.content_html, '');
  if (!content.ok) return { ok: false, message: content.message };

  const attachmentIds = parseUuidArray(body.attachment_ids);
  if (!attachmentIds) return { ok: false, message: '첨부파일 형식이 올바르지 않습니다.' };

  const payload: WorkflowDraftPayload = {
    values: normalizeWorkflowValues(template.fields, raw.values),
    content_html: content.html,
    steps: line.steps,
    referrers: line.referrers
  };
  if (JSON.stringify(payload).length > DRAFT_MAX_JSON_LENGTH) {
    return { ok: false, message: '임시저장 내용이 너무 깁니다.' };
  }
  return { ok: true, payload, attachmentIds };
}
