import * as z from 'zod';
import type { AssigneeInput } from '@/features/asset-ledger/api/types';
import { parseSubscriptionAssigneeList } from '@/features/asset-ledger/lib/assignee-input';
import {
  ASSET_FIELD_MESSAGES,
  firstIssue,
  isPlainObject,
  managerMemoField,
  optionalAmount,
  optionalDate,
  optionalEmail,
  optionalEnum,
  optionalInt,
  optionalText,
  type FieldParseFailure
} from '@/features/asset-ledger/schemas/fields';
import {
  BILLING_CYCLES,
  PAYER_ENTITIES,
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_CURRENCIES,
  SUBSCRIPTION_STATUSES,
  type SubscriptionPayload
} from '../api/types';

/**
 * plan 103 — 구독 추가·수정 검증 (서버 Route · Sheet 폼 공용).
 * 대상자 배열은 구조 검증만(`parseSubscriptionAssigneeList`) — 사람 실존·active·비동방 확인은 서버가 한다.
 */

export const SUBSCRIPTION_FIELD_MESSAGES = {
  categoryRequired: '구분을 입력해 주세요.',
  nameRequired: '구독명을 입력해 주세요.',
  nameTooLong: '구독명은 80자까지 쓸 수 있어요.',
  planTooLong: '플랜은 80자까지 쓸 수 있어요.',
  purposeTooLong: '사용 목적은 200자까지 쓸 수 있어요.',
  statusRequired: '상태를 입력해 주세요.',
  payerInvalid: '결제 법인이 올바르지 않아요.',
  cardInvalid: '카드 끝 4자리는 숫자 4개로 적어 주세요.',
  cycleInvalid: '결제 주기가 올바르지 않아요.',
  billingDayInvalid: '결제일은 1~31 사이 숫자로 적어 주세요.',
  currencyInvalid: '통화가 올바르지 않아요.'
} as const;

export const subscriptionFieldsSchema = z.object({
  category: z.enum(SUBSCRIPTION_CATEGORIES, { error: SUBSCRIPTION_FIELD_MESSAGES.categoryRequired }),
  name: z
    .string({ error: SUBSCRIPTION_FIELD_MESSAGES.nameRequired })
    .trim()
    .min(1, SUBSCRIPTION_FIELD_MESSAGES.nameRequired)
    .max(80, SUBSCRIPTION_FIELD_MESSAGES.nameTooLong),
  plan_name: optionalText(80, SUBSCRIPTION_FIELD_MESSAGES.planTooLong),
  purpose: optionalText(200, SUBSCRIPTION_FIELD_MESSAGES.purposeTooLong),
  status: z.enum(SUBSCRIPTION_STATUSES, { error: SUBSCRIPTION_FIELD_MESSAGES.statusRequired }).optional(),
  expires_on: optionalDate,
  payer_entity: optionalEnum(PAYER_ENTITIES, SUBSCRIPTION_FIELD_MESSAGES.payerInvalid),
  card_last4: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z
      .string({ error: SUBSCRIPTION_FIELD_MESSAGES.cardInvalid })
      .trim()
      .regex(/^[0-9]{4}$/, SUBSCRIPTION_FIELD_MESSAGES.cardInvalid)
      .nullable()
      .optional()
  ),
  billing_cycle: optionalEnum(BILLING_CYCLES, SUBSCRIPTION_FIELD_MESSAGES.cycleInvalid),
  billing_day: optionalInt(1, 31, SUBSCRIPTION_FIELD_MESSAGES.billingDayInvalid),
  billing_date: optionalDate,
  amount: optionalAmount({ integer: false }),
  currency: optionalEnum(SUBSCRIPTION_CURRENCIES, SUBSCRIPTION_FIELD_MESSAGES.currencyInvalid),
  amount_varies: z.boolean({ error: ASSET_FIELD_MESSAGES.invalidNumber }).optional(),
  started_on: optionalDate,
  owner_account: optionalEmail,
  manager_memo: managerMemoField
});

export const subscriptionUpdateFieldsSchema = subscriptionFieldsSchema.partial();

export type SubscriptionFieldValues = z.output<typeof subscriptionFieldsSchema>;

/** DB에 쓸 칸 (assignees 제외) */
export type SubscriptionWritableFields = Partial<Omit<SubscriptionPayload, 'assignees'>>;

export type ParsedSubscriptionPayload =
  | {
      ok: true;
      fields: SubscriptionWritableFields;
      /** 보낸 경우에만 — 통째로 교체 */
      assignees: AssigneeInput[] | undefined;
      /** 보낸 키(PATCH changed_fields 계산용 · 이름만) */
      providedKeys: string[];
    }
  | FieldParseFailure;

const WRITABLE_KEYS = Object.keys(subscriptionFieldsSchema.shape);

export function parseSubscriptionPayload(
  raw: unknown,
  mode: 'create' | 'update'
): ParsedSubscriptionPayload {
  if (!isPlainObject(raw)) {
    return { ok: false, message: '요청 본문이 올바르지 않습니다.', field: null };
  }

  const schema = mode === 'create' ? subscriptionFieldsSchema : subscriptionUpdateFieldsSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  let assignees: AssigneeInput[] | undefined;
  if ('assignees' in raw && raw.assignees !== undefined) {
    const list = parseSubscriptionAssigneeList(raw.assignees);
    if (!list.ok) {
      return { ok: false, message: list.message, field: 'assignees' };
    }
    assignees = list.value;
  }

  const providedKeys = WRITABLE_KEYS.filter((key) => key in raw && raw[key] !== undefined);
  if (mode === 'update' && providedKeys.length === 0 && assignees === undefined) {
    return { ok: false, message: ASSET_FIELD_MESSAGES.nothingToUpdate, field: null };
  }

  const fields: SubscriptionWritableFields = {};
  const data = parsed.data as Record<string, unknown>;
  for (const key of providedKeys) {
    (fields as Record<string, unknown>)[key] = data[key] ?? null;
  }
  if (mode === 'create') {
    fields.status = (data.status as SubscriptionWritableFields['status']) ?? 'active';
    fields.amount_varies = (data.amount_varies as boolean | undefined) ?? false;
  }
  if ('amount_varies' in fields && fields.amount_varies === null) {
    fields.amount_varies = false;
  }

  return { ok: true, fields, assignees, providedKeys };
}
