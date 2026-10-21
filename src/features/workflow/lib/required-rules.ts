/**
 * 워크플로우 조건부 필수 판정 — 클라이언트 폼과 서버 Route가 **같이** import하는 단일 정의 (plan 88 AC-47).
 * 순수 TS (server-only 아님). 서버는 DB에서 읽은 양식 필드 정의(또는 문서 template_snapshot)로만 실행한다.
 */

export const WORKFLOW_FIELD_TYPES = [
  'STRING',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'AMOUNT_OF_MONEY',
  'TASK_REFERENCE'
] as const;

export type WorkflowFieldType = (typeof WORKFLOW_FIELD_TYPES)[number];

/** `{"field_key": "<다른 필드 key>", "in": ["값1", ...]}` */
export type WorkflowRequiredWhen = {
  field_key: string;
  in: string[];
};

export type WorkflowFieldRule = {
  field_key: string;
  name: string;
  type: WorkflowFieldType;
  options: string[];
  required: boolean;
  required_when: WorkflowRequiredWhen | null;
};

export type WorkflowAttachmentRule = {
  attachment_visible: boolean;
  attachment_required: boolean;
  attachment_required_when: WorkflowRequiredWhen | null;
};

/** STRING·DATE·SELECT·AMOUNT = string, MULTISELECT·TASK_REFERENCE = string[] */
export type WorkflowInputValue = string | string[];

export type WorkflowInputValues = Record<string, WorkflowInputValue | null | undefined>;

/** 첨부 오류의 field_key (폼·서버 400 body 공통) */
export const WORKFLOW_ATTACHMENT_ERROR_KEY = '__attachments';
/** 결재선 오류의 field_key */
export const WORKFLOW_APPROVAL_LINE_ERROR_KEY = '__approval_line';

export const WORKFLOW_ATTACHMENT_MAX_COUNT = 30;
export const WORKFLOW_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const WORKFLOW_STRING_MAX_LENGTH = 2000;
export const WORKFLOW_REFERENCE_MAX_COUNT = 20;
export const WORKFLOW_COMMENT_MAX_LENGTH = 2000;
/** 금액 상한 (1조 원 미만) */
export const WORKFLOW_AMOUNT_MAX = 999_999_999_999;

export const WORKFLOW_MESSAGES = {
  fieldRequired: (name: string) => `${name} 항목을 입력해 주세요.`,
  selectInvalid: (name: string) => `${name} 값이 올바르지 않습니다.`,
  dateInvalid: (name: string) => `${name} 값이 올바르지 않습니다.`,
  stringTooLong: (name: string) =>
    `${name} 항목은 ${WORKFLOW_STRING_MAX_LENGTH}자 이내로 입력해 주세요.`,
  amountInvalid: '금액은 0보다 큰 숫자로 입력해 주세요.',
  attachmentRequired: '첨부파일을 1개 이상 올려 주세요.',
  attachmentTooLarge: '파일당 20MB 이하만 올릴 수 있습니다.',
  attachmentTooMany: '첨부파일은 최대 30개까지 올릴 수 있습니다.',
  referenceTooMany: '참조문서는 최대 20개까지 연결할 수 있습니다.',
  referenceInvalid: '참조할 수 없는 문서가 있습니다.',
  approverRequired: '승인자를 1명 이상 지정해 주세요.',
  emptyStep: '승인자가 없는 단계가 있습니다.',
  duplicateApprover: '같은 승인자를 여러 번 지정할 수 없습니다.',
  duplicateReferrer: '같은 참조자를 여러 번 지정할 수 없습니다.',
  writerAsApprover: '작성자는 승인자로 지정할 수 없습니다.',
  inactiveUser: '비활성 사용자는 지정할 수 없습니다.',
  tooManySteps: '승인 단계는 최대 20개까지 지정할 수 있습니다.',
  commentRequired: '댓글을 입력해 주세요.',
  commentTooLong: '댓글은 2000자 이내로 입력해 주세요.'
} as const;

export type WorkflowValidationError = {
  field_key: string;
  message: string;
};

/** trim 후 빈 문자열이면 미입력. `"-"`는 값으로 인정한다. 배열은 빈 배열이면 미입력. */
export function isEmptyWorkflowValue(value: WorkflowInputValue | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim() !== '').length === 0;
  }
  return value.trim() === '';
}

/** required_when 규칙이 현재 값과 맞는지 (SELECT 값 또는 MULTISELECT 배열 교집합) */
export function matchesRequiredWhen(
  rule: WorkflowRequiredWhen | null | undefined,
  values: WorkflowInputValues
): boolean {
  if (!rule || typeof rule.field_key !== 'string' || !Array.isArray(rule.in)) {
    return false;
  }
  const source = values[rule.field_key];
  if (source === null || source === undefined) return false;
  if (Array.isArray(source)) {
    return source.some((item) => rule.in.includes(item.trim()));
  }
  return rule.in.includes(source.trim());
}

export function isFieldRequired(
  field: Pick<WorkflowFieldRule, 'required' | 'required_when'>,
  values: WorkflowInputValues
): boolean {
  return field.required || matchesRequiredWhen(field.required_when, values);
}

export function isAttachmentRequired(
  rule: WorkflowAttachmentRule,
  values: WorkflowInputValues
): boolean {
  if (!rule.attachment_visible) return false;
  return rule.attachment_required || matchesRequiredWhen(rule.attachment_required_when, values);
}

/** 금액 입력 → 콤마·공백 제거 정수 문자열 */
export function normalizeAmountInput(value: string): string {
  return value.replace(/[,\s원₩]/g, '');
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidWorkflowDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

function validateFieldValue(
  field: WorkflowFieldRule,
  value: WorkflowInputValue | null | undefined
): string | null {
  if (isEmptyWorkflowValue(value)) return null;

  switch (field.type) {
    case 'SELECT': {
      const text = typeof value === 'string' ? value.trim() : '';
      return field.options.includes(text) ? null : WORKFLOW_MESSAGES.selectInvalid(field.name);
    }
    case 'MULTISELECT': {
      if (!Array.isArray(value)) return WORKFLOW_MESSAGES.selectInvalid(field.name);
      const ok = value.every((item) => field.options.includes(item.trim()));
      return ok ? null : WORKFLOW_MESSAGES.selectInvalid(field.name);
    }
    case 'DATE': {
      const text = typeof value === 'string' ? value.trim() : '';
      return isValidWorkflowDate(text) ? null : WORKFLOW_MESSAGES.dateInvalid(field.name);
    }
    case 'AMOUNT_OF_MONEY': {
      const text = typeof value === 'string' ? normalizeAmountInput(value) : '';
      if (!/^\d+$/.test(text)) return WORKFLOW_MESSAGES.amountInvalid;
      const amount = Number(text);
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > WORKFLOW_AMOUNT_MAX) {
        return WORKFLOW_MESSAGES.amountInvalid;
      }
      return null;
    }
    case 'TASK_REFERENCE': {
      if (!Array.isArray(value)) return WORKFLOW_MESSAGES.referenceInvalid;
      return value.length > WORKFLOW_REFERENCE_MAX_COUNT ? WORKFLOW_MESSAGES.referenceTooMany : null;
    }
    case 'STRING':
    default: {
      const text = typeof value === 'string' ? value : '';
      return text.length > WORKFLOW_STRING_MAX_LENGTH ? WORKFLOW_MESSAGES.stringTooLong(field.name) : null;
    }
  }
}

/**
 * 입력칸 + 첨부 검증. 필드 display 순서대로 오류를 돌려준다(첨부 오류는 마지막).
 * 필수가 아닌 칸은 빈 값으로 제출할 수 있다.
 */
export function validateWorkflowInputs(input: {
  fields: WorkflowFieldRule[];
  values: WorkflowInputValues;
  attachmentRule?: WorkflowAttachmentRule | null;
  attachmentCount?: number;
}): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];

  for (const field of input.fields) {
    const value = input.values[field.field_key];
    if (isFieldRequired(field, input.values) && isEmptyWorkflowValue(value)) {
      errors.push({ field_key: field.field_key, message: WORKFLOW_MESSAGES.fieldRequired(field.name) });
      continue;
    }
    const message = validateFieldValue(field, value);
    if (message) {
      errors.push({ field_key: field.field_key, message });
    }
  }

  if (input.attachmentRule) {
    const count = input.attachmentCount ?? 0;
    if (count > WORKFLOW_ATTACHMENT_MAX_COUNT) {
      errors.push({ field_key: WORKFLOW_ATTACHMENT_ERROR_KEY, message: WORKFLOW_MESSAGES.attachmentTooMany });
    } else if (isAttachmentRequired(input.attachmentRule, input.values) && count < 1) {
      errors.push({ field_key: WORKFLOW_ATTACHMENT_ERROR_KEY, message: WORKFLOW_MESSAGES.attachmentRequired });
    }
  }

  return errors;
}
