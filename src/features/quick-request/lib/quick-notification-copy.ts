import type { QuickRequestPatchKey } from '../schemas/quick-request-workflow';

/**
 * plan 94 — 퀵 알림 문구 중 순수 계산(단위 테스트 대상). DB·server-only 의존 없음.
 * - D-13 채팅 알림 제목 `{보낸 사람 이름(20자)} · {요청번호}` · 본문 = 메시지 원문(200자)
 * - D-11 `updated` 알림 본문 `{행위자}님이 요청 내용을 수정했습니다. ({변경 항목 라벨 최대 3개}{ 외 N개})`
 * 이 파일은 path alias(`@/…`)·server 모듈을 import하지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

export const QUICK_NOTIFICATION_TITLE_MAX_LENGTH = 30;
export const QUICK_CHAT_NOTIFICATION_BODY_MAX_LENGTH = 200;
export const QUICK_CHAT_SENDER_NAME_MAX_LENGTH = 20;
export const QUICK_UPDATED_LABELS_MAX = 3;

const CHAT_TITLE_SEPARATOR = ' · ';

/** C-6 유지 — 원문 그대로(앞뒤 공백만 제거), 200자 초과면 199자 + `…`, 줄바꿈 유지 */
export function clipChatNotificationBody(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > QUICK_CHAT_NOTIFICATION_BODY_MAX_LENGTH
    ? `${trimmed.slice(0, QUICK_CHAT_NOTIFICATION_BODY_MAX_LENGTH - 1)}…`
    : trimmed;
}

/**
 * D-13 — 제목 `{이름} · {요청번호}`. 이름은 20자 클립, 전체는 30자(U-7)를 넘지 않도록 이름을 더 줄인다.
 * 예: `김동방 · 2026-07`
 */
export function buildChatNotificationTitle(requestNo: string, senderName: string): string {
  const no = requestNo.trim();
  const nameBudget = Math.max(
    1,
    Math.min(
      QUICK_CHAT_SENDER_NAME_MAX_LENGTH,
      QUICK_NOTIFICATION_TITLE_MAX_LENGTH - CHAT_TITLE_SEPARATOR.length - no.length
    )
  );
  const name = senderName.replace(/\s+/g, ' ').trim().slice(0, nameBudget);
  return `${name}${CHAT_TITLE_SEPARATOR}${no}`;
}

/** D-11 — PATCH 키 → 한국어 라벨 (출발지·도착지는 하위 필드 라벨을 따로 만든다) */
export const QUICK_REQUEST_PATCH_FIELD_LABELS: Record<QuickRequestPatchKey, string> = {
  origin: '출발지',
  stopovers: '경유지',
  destination: '도착지',
  goodsSize: '물품 크기',
  itemDescription: '물품 내용',
  vehicleTypes: '차량 종류',
  vehicleOtherText: '기타 차량',
  vehicleCount: '차량 대수',
  freightPayment: '운임',
  estimatedAmount: '예상금액',
  dispatchVehicleInfo: '자동차등록번호',
  driverName: '기사 이름',
  driverPhone: '기사 연락처',
  finalAmount: '최종금액'
};

/** 본문에 나열하는 순서 (폼 순서 · 등록 순서와 무관) */
const LABEL_ORDER: readonly QuickRequestPatchKey[] = [
  'origin',
  'stopovers',
  'destination',
  'goodsSize',
  'itemDescription',
  'vehicleTypes',
  'vehicleOtherText',
  'vehicleCount',
  'freightPayment',
  'estimatedAmount',
  'dispatchVehicleInfo',
  'driverName',
  'driverPhone',
  'finalAmount'
];

/** 출발지·도착지 하위 필드 라벨 (순서 = 폼 순서) */
const LOCATION_SUBFIELD_LABELS: readonly [key: string, label: string][] = [
  ['roadAddress', '주소'],
  ['detailAddress', '상세주소'],
  ['contactName', '담당자'],
  ['contactPhone', '담당 연락처'],
  ['schedule', '일정'],
  ['notes', '전달사항'],
  ['memo', '메모']
];

export type QuickRequestFieldChange = {
  key: QuickRequestPatchKey;
  before: unknown;
  after: unknown;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 출발지/도착지는 바뀐 하위 필드별 라벨(`도착지 상세주소`). 하위 비교가 안 되면 상위 라벨 1개 */
function locationLabels(base: string, before: unknown, after: unknown): string[] {
  if (!isRecord(before) || !isRecord(after)) {
    return [base];
  }
  const labels = LOCATION_SUBFIELD_LABELS.filter(
    ([key]) => stableStringify(before[key]) !== stableStringify(after[key])
  ).map(([, label]) => `${base} ${label}`);
  return labels.length > 0 ? labels : [base];
}

/**
 * 변경 항목 → 라벨 목록 (중복 없음 · 표시 순서). `finalAmount`는 호출부가 미리 뺀다(별도 `final_amount_set` 알림).
 */
export function buildQuickRequestChangedLabels(changes: readonly QuickRequestFieldChange[]): string[] {
  const byKey = new Map(changes.map((change) => [change.key, change] as const));
  const labels: string[] = [];
  for (const key of LABEL_ORDER) {
    const change = byKey.get(key);
    if (!change) continue;
    if (key === 'origin' || key === 'destination') {
      labels.push(...locationLabels(QUICK_REQUEST_PATCH_FIELD_LABELS[key], change.before, change.after));
    } else {
      labels.push(QUICK_REQUEST_PATCH_FIELD_LABELS[key]);
    }
  }
  return [...new Set(labels)];
}

/** D-11 — `{행위자}님이 요청 내용을 수정했습니다. (도착지 상세주소, 차량 종류)` · 4개 이상이면 `(a, b, c 외 N개)` */
export function buildQuickRequestUpdatedBody(actorName: string, labels: readonly string[]): string {
  const shown = labels.slice(0, QUICK_UPDATED_LABELS_MAX);
  const rest = labels.length - shown.length;
  const detail = shown.length > 0 ? ` (${shown.join(', ')}${rest > 0 ? ` 외 ${rest}개` : ''})` : '';
  return `${actorName}님이 요청 내용을 수정했습니다.${detail}`;
}
