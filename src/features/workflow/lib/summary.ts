/**
 * 목록 행 한 줄 요약 (plan 88 AC-12 · designer §2.6).
 * 「{필드명}: {값}」을 display_order 순으로 ` · `로 잇고 빈 값은 건너뛴다. TASK_REFERENCE는 제외. 문서번호 미포함.
 */
import { formatAmountWonPrefix } from './format-amount';
import { isEmptyWorkflowValue, type WorkflowFieldType, type WorkflowInputValue } from './required-rules';

export type WorkflowSummaryField = {
  field_key: string;
  name: string;
  type: WorkflowFieldType;
  display_order?: number;
};

export function buildWorkflowSummary(
  fields: WorkflowSummaryField[],
  values: Record<string, WorkflowInputValue | null | undefined>
): string {
  const ordered = [...fields].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const parts: string[] = [];

  for (const field of ordered) {
    if (field.type === 'TASK_REFERENCE') continue;
    const value = values[field.field_key];
    if (isEmptyWorkflowValue(value)) continue;

    let text: string;
    if (field.type === 'AMOUNT_OF_MONEY') {
      text = formatAmountWonPrefix(typeof value === 'string' ? value : '');
    } else if (Array.isArray(value)) {
      text = value.map((item) => item.trim()).filter(Boolean).join(', ');
    } else {
      text = (value ?? '').trim().replace(/\s+/g, ' ');
    }
    if (!text) continue;
    parts.push(`${field.name}: ${text}`);
  }

  return parts.join(' · ');
}
