import 'server-only';

import { valuesToInputItems } from '../lib/inputs';
import type { WorkflowFieldType, WorkflowInputValue } from '../lib/required-rules';
import {
  sanitizeWorkflowHtml,
  WORKFLOW_CONTENT_MAX_LENGTH,
  workflowHtmlToPlainText
} from '../lib/sanitize-html.server';

export const WORKFLOW_CONTENT_TOO_LONG_MESSAGE = '본문이 너무 깁니다.';

/** 본문 HTML 서버 정화 (undefined → fallback 유지) */
export function prepareWorkflowContent(
  raw: unknown,
  fallback = ''
): { ok: true; html: string } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, html: fallback };
  if (raw === null) return { ok: true, html: '' };
  if (typeof raw !== 'string') return { ok: false, message: '본문 형식이 올바르지 않습니다.' };
  if (raw.length > WORKFLOW_CONTENT_MAX_LENGTH) return { ok: false, message: WORKFLOW_CONTENT_TOO_LONG_MESSAGE };
  return { ok: true, html: sanitizeWorkflowHtml(raw) };
}

/** 검색용 텍스트 (문서번호는 RPC가 앞에 붙인다) */
export function buildWorkflowSearchText(input: {
  templateName: string;
  writerName: string;
  fields: { field_key: string; type: WorkflowFieldType }[];
  values: Record<string, WorkflowInputValue>;
  contentHtml: string;
}): string {
  const parts: string[] = [input.templateName, input.writerName];
  for (const field of input.fields) {
    if (field.type === 'TASK_REFERENCE') continue;
    const value = input.values[field.field_key];
    if (Array.isArray(value)) parts.push(value.join(' '));
    else if (value) parts.push(value);
  }
  if (input.contentHtml) parts.push(workflowHtmlToPlainText(input.contentHtml));
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 19000);
}

export function toInputItems(
  fields: { field_key: string; type: WorkflowFieldType; display_order?: number }[],
  values: Record<string, WorkflowInputValue>
) {
  return valuesToInputItems(fields, values);
}
