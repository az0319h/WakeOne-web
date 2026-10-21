/**
 * 입력값 정규화 · 변환 (클라·서버 공용, 순수 TS).
 * 저장 형식: inputs = [{ field_key, value }] (양식 필드 순서), value는 string 또는 string[].
 */
import {
  normalizeAmountInput,
  type WorkflowFieldType,
  type WorkflowInputValue
} from './required-rules';

type FieldLike = { field_key: string; type: WorkflowFieldType; display_order?: number };

const ARRAY_TYPES: WorkflowFieldType[] = ['MULTISELECT', 'TASK_REFERENCE'];

export function isArrayFieldType(type: WorkflowFieldType): boolean {
  return ARRAY_TYPES.includes(type);
}

function normalizeOne(type: WorkflowFieldType, raw: unknown): WorkflowInputValue {
  if (isArrayFieldType(type)) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const text = item.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw !== 'string') return '';
  if (type === 'AMOUNT_OF_MONEY') return normalizeAmountInput(raw.trim());
  if (type === 'STRING') return raw.replace(/\r\n/g, '\n').trim();
  return raw.trim();
}

/** 양식 필드 정의에 있는 키만 남기고 타입별로 정규화한다(알 수 없는 키·클라이언트가 보낸 규칙은 버림). */
export function normalizeWorkflowValues(
  fields: FieldLike[],
  raw: unknown,
  base?: Record<string, WorkflowInputValue>
): Record<string, WorkflowInputValue> {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const result: Record<string, WorkflowInputValue> = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field.field_key)) {
      result[field.field_key] = normalizeOne(field.type, source[field.field_key]);
    } else if (base && Object.prototype.hasOwnProperty.call(base, field.field_key)) {
      result[field.field_key] = base[field.field_key];
    } else {
      result[field.field_key] = isArrayFieldType(field.type) ? [] : '';
    }
  }
  return result;
}

export function valuesToInputItems(
  fields: FieldLike[],
  values: Record<string, WorkflowInputValue>
): { field_key: string; value: WorkflowInputValue }[] {
  return [...fields]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((field) => ({
      field_key: field.field_key,
      value: values[field.field_key] ?? (isArrayFieldType(field.type) ? [] : '')
    }));
}

export function inputItemsToValues(
  inputs: { field_key: string; value: unknown }[] | null | undefined
): Record<string, WorkflowInputValue> {
  const values: Record<string, WorkflowInputValue> = {};
  for (const item of inputs ?? []) {
    if (!item || typeof item.field_key !== 'string') continue;
    if (Array.isArray(item.value)) {
      values[item.field_key] = item.value.filter((v): v is string => typeof v === 'string');
    } else if (typeof item.value === 'string') {
      values[item.field_key] = item.value;
    } else if (typeof item.value === 'number') {
      values[item.field_key] = String(item.value);
    } else {
      values[item.field_key] = '';
    }
  }
  return values;
}

/** TASK_REFERENCE 필드 값(document id 배열)을 모두 모은다 */
export function collectReferenceIds(
  fields: FieldLike[],
  values: Record<string, WorkflowInputValue>
): string[] {
  const ids = new Set<string>();
  for (const field of fields) {
    if (field.type !== 'TASK_REFERENCE') continue;
    const value = values[field.field_key];
    if (Array.isArray(value)) value.forEach((id) => ids.add(id));
  }
  return [...ids];
}

function sameValue(a: WorkflowInputValue | undefined, b: WorkflowInputValue | undefined): boolean {
  const left = a ?? '';
  const right = b ?? '';
  if (Array.isArray(left) || Array.isArray(right)) {
    const la = Array.isArray(left) ? left : left ? [left] : [];
    const ra = Array.isArray(right) ? right : right ? [right] : [];
    return la.length === ra.length && la.every((item, index) => item === ra[index]);
  }
  return left === right;
}

/** 값이 바뀐 field_key 목록 (필드 순서) */
export function diffChangedFieldKeys(
  fields: FieldLike[],
  before: Record<string, WorkflowInputValue>,
  after: Record<string, WorkflowInputValue>
): string[] {
  return [...fields]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .filter((field) => !sameValue(before[field.field_key], after[field.field_key]))
    .map((field) => field.field_key);
}
