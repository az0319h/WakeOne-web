import * as z from 'zod';
import { parseEquipmentAssignee } from '@/features/asset-ledger/lib/assignee-input';
import {
  ASSET_FIELD_MESSAGES,
  firstIssue,
  isPlainObject,
  managerMemoField,
  optionalAmount,
  optionalDate,
  optionalEnum,
  optionalText,
  type FieldParseFailure
} from '@/features/asset-ledger/schemas/fields';
import {
  ASSET_NO_PATTERN,
  EQUIPMENT_KINDS,
  EQUIPMENT_PREFIXES_BY_KIND,
  EQUIPMENT_STATUSES,
  LEDGER_ENTITIES,
  assetNoPrefix,
  type EquipmentKind,
  type EquipmentPayload
} from '../api/types';

/**
 * plan 103 — 비품 추가·수정 검증 (서버 Route · Sheet 폼 공용).
 * 자산번호 중복(409 「이미 있는 자산번호예요.」)은 DB를 봐야 하므로 서버가 따로 판정한다.
 */

export const EQUIPMENT_FIELD_MESSAGES = {
  assetNoRequired: '자산번호를 입력해 주세요.',
  assetNoFormat: '자산번호는 N-001처럼 적어 주세요.',
  prefixMismatch: '품목과 자산번호 앞글자가 맞지 않아요.',
  duplicateAssetNo: '이미 있는 자산번호예요.',
  kindRequired: '품목을 입력해 주세요.',
  modelTooLong: '모델·시리얼은 120자까지 쓸 수 있어요.',
  statusRequired: '상태를 입력해 주세요.',
  ledgerInvalid: '회계장부가 올바르지 않아요.',
  ledgerCodeTooLong: '장부코드는 40자까지 쓸 수 있어요.',
  vendorTooLong: '구입처는 80자까지 쓸 수 있어요.',
  invalidPrefix: '자산번호 앞글자가 올바르지 않아요.'
} as const;

export const equipmentFieldsSchema = z.object({
  asset_no: z
    .string({ error: EQUIPMENT_FIELD_MESSAGES.assetNoRequired })
    .trim()
    .toUpperCase()
    .min(1, EQUIPMENT_FIELD_MESSAGES.assetNoRequired)
    .regex(ASSET_NO_PATTERN, EQUIPMENT_FIELD_MESSAGES.assetNoFormat),
  kind: z.enum(EQUIPMENT_KINDS, { error: EQUIPMENT_FIELD_MESSAGES.kindRequired }),
  model_serial: optionalText(120, EQUIPMENT_FIELD_MESSAGES.modelTooLong),
  status: z.enum(EQUIPMENT_STATUSES, { error: EQUIPMENT_FIELD_MESSAGES.statusRequired }).optional(),
  ledger_entity: optionalEnum(LEDGER_ENTITIES, EQUIPMENT_FIELD_MESSAGES.ledgerInvalid),
  ledger_code: optionalText(40, EQUIPMENT_FIELD_MESSAGES.ledgerCodeTooLong),
  purchase_amount: optionalAmount({ integer: true }),
  purchased_on: optionalDate,
  vendor: optionalText(80, EQUIPMENT_FIELD_MESSAGES.vendorTooLong),
  manager_memo: managerMemoField
});

export const equipmentUpdateFieldsSchema = equipmentFieldsSchema.partial();

export type EquipmentWritableFields = Partial<Omit<EquipmentPayload, 'assignee'>>;

export function isPrefixAllowedForKind(kind: EquipmentKind, assetNo: string): boolean {
  const prefix = assetNoPrefix(assetNo);
  return prefix !== null && EQUIPMENT_PREFIXES_BY_KIND[kind].includes(prefix);
}

export type ParsedEquipmentPayload =
  | {
      ok: true;
      fields: EquipmentWritableFields;
      /** undefined = 안 보냄(유지) · null = 비어 있음 */
      assignee: EquipmentPayload['assignee'] | undefined;
      providedKeys: string[];
    }
  | FieldParseFailure;

const WRITABLE_KEYS = Object.keys(equipmentFieldsSchema.shape);

export function parseEquipmentPayload(raw: unknown, mode: 'create' | 'update'): ParsedEquipmentPayload {
  if (!isPlainObject(raw)) {
    return { ok: false, message: '요청 본문이 올바르지 않습니다.', field: null };
  }

  const schema = mode === 'create' ? equipmentFieldsSchema : equipmentUpdateFieldsSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  let assignee: EquipmentPayload['assignee'] | undefined;
  if ('assignee' in raw && raw.assignee !== undefined) {
    const result = parseEquipmentAssignee(raw.assignee);
    if (!result.ok) {
      return { ok: false, message: result.message, field: 'assignee' };
    }
    assignee = result.value;
  }

  const providedKeys = WRITABLE_KEYS.filter((key) => key in raw && raw[key] !== undefined);
  if (mode === 'update' && providedKeys.length === 0 && assignee === undefined) {
    return { ok: false, message: ASSET_FIELD_MESSAGES.nothingToUpdate, field: null };
  }

  const data = parsed.data as Record<string, unknown>;
  const fields: EquipmentWritableFields = {};
  for (const key of providedKeys) {
    (fields as Record<string, unknown>)[key] = data[key] ?? null;
  }
  if (mode === 'create') {
    fields.status = (data.status as EquipmentWritableFields['status']) ?? 'in_use';
    const kind = data.kind as EquipmentKind;
    const assetNo = data.asset_no as string;
    if (!isPrefixAllowedForKind(kind, assetNo)) {
      return { ok: false, message: EQUIPMENT_FIELD_MESSAGES.prefixMismatch, field: 'asset_no' };
    }
  }

  return { ok: true, fields, assignee, providedKeys };
}
