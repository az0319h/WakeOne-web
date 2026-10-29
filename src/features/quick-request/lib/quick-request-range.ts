import { getKstTodayDateString } from '@/lib/kst';

/**
 * plan 97 D-1 — 퀵 조회 기간 공용 (서버 Route · FE nuqs/라벨 공용 · `server-only` import 금지).
 * `range` ∈ 7d(기본)·30d·90d·all·custom, `from`·`to`는 `yyyy-MM-dd`(custom일 때만). KST 기준 오늘 포함 N일.
 */

export const QUICK_RANGE_KINDS = ['7d', '30d', '90d', 'all', 'custom'] as const;
export type QuickRangeKind = (typeof QUICK_RANGE_KINDS)[number];

export const QUICK_RANGE_DEFAULT_KIND = '7d' as const satisfies QuickRangeKind;

/** 프리셋 일수 (오늘 포함) */
export const QUICK_RANGE_PRESET_DAYS: Record<Exclude<QuickRangeKind, 'all' | 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

/** 400 응답 문구 (custom `from > to` · 날짜 형식 불량) */
export const QUICK_RANGE_INVALID_MESSAGE = '기간을 확인해 주세요.';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET = '+09:00';

export type QuickRangeInput = {
  range?: string | null;
  from?: string | null;
  to?: string | null;
};

export type QuickRange = {
  kind: QuickRangeKind;
  /** KST `yyyy-MM-dd` (포함) · `all`이면 null */
  from: string | null;
  /** KST `yyyy-MM-dd` (포함) · `all`이면 null */
  to: string | null;
  /** DB 비교용 시작(포함) `yyyy-MM-ddT00:00:00+09:00` · `all`이면 null */
  fromIso: string | null;
  /** DB 비교용 끝(배타) — `to` 다음날 00:00 KST · `all`이면 null */
  toIso: string | null;
};

export type QuickRangeParseResult =
  | { ok: true; range: QuickRange }
  | { ok: false; message: string };

export function isQuickRangeKind(value: string | null | undefined): value is QuickRangeKind {
  return Boolean(value && (QUICK_RANGE_KINDS as readonly string[]).includes(value));
}

/** `yyyy-MM-dd` 형식 + 실제 존재하는 날짜 */
export function isQuickRangeDate(value: string | null | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** `yyyy-MM-dd` + n일 (달력 산술 · 시간대 무관) */
export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function kstStartIso(date: string): string {
  return `${date}T00:00:00${KST_OFFSET}`;
}

function buildRange(kind: QuickRangeKind, from: string | null, to: string | null): QuickRange {
  return {
    kind,
    from,
    to,
    fromIso: from ? kstStartIso(from) : null,
    toIso: to ? kstStartIso(addDaysToDateString(to, 1)) : null
  };
}

/**
 * 쿼리 → 기간. 잘못된 `range`는 기본(7d)으로 정정(200). `custom`은 `from`·`to` 필수·유효·`from ≤ to` 아니면 실패(400).
 * `now`는 테스트용 (KST 오늘 계산).
 */
export function parseQuickRange(input: QuickRangeInput, now = new Date()): QuickRangeParseResult {
  const kind: QuickRangeKind = isQuickRangeKind(input.range) ? input.range : QUICK_RANGE_DEFAULT_KIND;

  if (kind === 'all') {
    return { ok: true, range: buildRange('all', null, null) };
  }

  if (kind === 'custom') {
    const from = input.from ?? null;
    const to = input.to ?? null;
    if (!isQuickRangeDate(from) || !isQuickRangeDate(to) || from > to) {
      return { ok: false, message: QUICK_RANGE_INVALID_MESSAGE };
    }
    return { ok: true, range: buildRange('custom', from, to) };
  }

  const today = getKstTodayDateString(now);
  const from = addDaysToDateString(today, -(QUICK_RANGE_PRESET_DAYS[kind] - 1));
  return { ok: true, range: buildRange(kind, from, today) };
}

/**
 * 보조 문구 (designer §1-1 정확한 문자열):
 * `기간: 최근 7일` · `기간: 최근 30일` · `기간: 최근 90일` · `기간: 전체` · `기간: 2026-10-01 ~ 2026-10-27`.
 * custom인데 from/to가 불량이면 기본(7d) 문구.
 */
export function quickRangeLabel(input: QuickRangeInput): string {
  const kind: QuickRangeKind = isQuickRangeKind(input.range) ? input.range : QUICK_RANGE_DEFAULT_KIND;

  if (kind === 'all') {
    return '기간: 전체';
  }

  if (kind === 'custom') {
    const from = input.from ?? null;
    const to = input.to ?? null;
    if (isQuickRangeDate(from) && isQuickRangeDate(to) && from <= to) {
      return `기간: ${from} ~ ${to}`;
    }
    return `기간: 최근 ${QUICK_RANGE_PRESET_DAYS[QUICK_RANGE_DEFAULT_KIND]}일`;
  }

  return `기간: 최근 ${QUICK_RANGE_PRESET_DAYS[kind]}일`;
}

/** 쿼리스트링 직렬화 (기본 7d는 생략 · custom만 from/to) — service.ts 공용 */
export function appendQuickRangeSearchParams(params: URLSearchParams, input: QuickRangeInput): void {
  const kind: QuickRangeKind = isQuickRangeKind(input.range) ? input.range : QUICK_RANGE_DEFAULT_KIND;
  if (kind === QUICK_RANGE_DEFAULT_KIND) return;
  params.set('range', kind);
  if (kind === 'custom') {
    if (input.from) params.set('from', input.from);
    if (input.to) params.set('to', input.to);
  }
}
