/**
 * plan 102 — overview 생일 휠 목록 순수 로직 (반년 순환 offset · 정렬 · 가운데 index · 라벨 · 컨페티 키).
 * 이 파일은 path alias(`@/…`)·런타임 상대 import를 쓰지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 * (타입 import만 허용 — Node 타입 스트리핑이 지운다)
 *
 * 실행: `node --test src/features/birthday-celebrants/lib/__tests__/birthday-order.test.mjs`
 */

import type { OrgAffiliation } from '@/features/users/constants/organization';
import type { BirthdayCelebrant } from '../api/types';

/** D-3 — 다음 생일까지 이 값 이하면 「다가오는」(양수), 넘으면 「지난」(음수)으로 본다 */
export const BIRTHDAY_FORWARD_MAX_DAYS = 182;

const MONTH_DAY_REGEX = /^(\d{2})-(\d{2})$/;
const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** `MM-DD` 유효성 검사용 윤년 (02-29 허용) */
const LEAP_YEAR_FOR_VALIDATION = 2000;

type DateParts = { year: number; month: number; day: number };
type MonthDayParts = { month: number; day: number };

function isRealDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parseDateParts(value: string): DateParts | null {
  const match = DATE_REGEX.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return isRealDate(year, month, day) ? { year, month, day } : null;
}

function parseMonthDayParts(value: string): MonthDayParts | null {
  const match = MONTH_DAY_REGEX.exec(value);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);

  return isRealDate(LEAP_YEAR_FOR_VALIDATION, month, day) ? { month, day } : null;
}

function toUtcMs({ year, month, day }: DateParts): number {
  return Date.UTC(year, month - 1, day);
}

/** D-17 — 평년의 02-29는 02-28을 생일 당일로 본다 */
function occurrenceInYear(year: number, { month, day }: MonthDayParts): DateParts {
  if (month === 2 && day === 29 && !isRealDate(year, 2, 29)) {
    return { year, month: 2, day: 28 };
  }

  return { year, month, day };
}

/**
 * DB `birthday`(`YYYY-MM-DD` · ISO datetime) 또는 `MM-DD` → `MM-DD`. 실제 달력 날짜가 아니면 null.
 * 응답에서 연도를 떼어 내는 용도(plan 102 D-10).
 */
export function toBirthdayMonthDay(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (parseMonthDayParts(trimmed)) {
    return trimmed;
  }

  const parts = parseDateParts(trimmed.slice(0, 10));
  if (!parts) {
    return null;
  }

  return `${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * D-3 — 기준일(KST `YYYY-MM-DD`) 대비 앞뒤 반년 순환 offset.
 * - 다음 생일까지 0~182일 → 그 값 (0 = 오늘)
 * - 183일 이상 → `-(지난 생일부터 지난 날)`
 *
 * 윤년(2월 29일)이 낀 366일 구간에서 앞뒤가 183일로 같으면 -183이 될 수 있다(D-3 문구 그대로).
 * 입력이 올바르지 않으면 null.
 */
export function getBirthdayDaysOffset(monthDay: string, referenceDate: string): number | null {
  const birthday = parseMonthDayParts(monthDay);
  const reference = parseDateParts(referenceDate);
  if (!birthday || !reference) {
    return null;
  }

  const referenceMs = toUtcMs(reference);
  let next = occurrenceInYear(reference.year, birthday);
  if (toUtcMs(next) < referenceMs) {
    next = occurrenceInYear(reference.year + 1, birthday);
  }

  const daysUntil = Math.round((toUtcMs(next) - referenceMs) / DAY_MS);
  if (daysUntil <= BIRTHDAY_FORWARD_MAX_DAYS) {
    return daysUntil;
  }

  const previous = occurrenceInYear(next.year - 1, birthday);
  const daysSince = Math.round((referenceMs - toUtcMs(previous)) / DAY_MS);

  return -daysSince;
}

type SortableCelebrant = Pick<BirthdayCelebrant, 'days_offset' | 'full_name' | 'user_id'>;

/** D-3 — `days_offset` 오름차순 → `full_name` 가나다(`ko`) → `user_id`(동명이인 고정) */
export function compareCelebrants(a: SortableCelebrant, b: SortableCelebrant): number {
  const offsetDiff = a.days_offset - b.days_offset;
  if (offsetDiff !== 0) {
    return offsetDiff;
  }

  const nameDiff = a.full_name.localeCompare(b.full_name, 'ko');
  if (nameDiff !== 0) {
    return nameDiff;
  }

  return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
}

/** 새 배열로 정렬해 돌려준다(원본 불변) */
export function sortCelebrants<T extends SortableCelebrant>(celebrants: readonly T[]): T[] {
  return [...celebrants].sort(compareCelebrants);
}

/**
 * D-4 — 정렬된 목록에서 가운데 줄 index.
 * `days_offset ≥ 0` 첫 항목 · 없으면 마지막(가장 최근 지난 생일) · 빈 배열이면 -1.
 */
export function findCenterIndex(celebrants: readonly Pick<BirthdayCelebrant, 'days_offset'>[]): number {
  if (celebrants.length === 0) {
    return -1;
  }

  const index = celebrants.findIndex((celebrant) => celebrant.days_offset >= 0);
  return index === -1 ? celebrants.length - 1 : index;
}

/** 탭 값 — 「전체」 + 조직 소속 (D-8 · 탭 순서·라벨은 UI에서 정한다) */
export const BIRTHDAY_TAB_ALL = 'all';

export type BirthdayTabValue = typeof BIRTHDAY_TAB_ALL | OrgAffiliation;

/** D-8 — 소속 탭 필터. 소속 없음(null)은 「전체」에만 남는다. 순서 유지 */
export function filterCelebrantsByTab<T extends Pick<BirthdayCelebrant, 'affiliation'>>(
  celebrants: readonly T[],
  tab: BirthdayTabValue
): T[] {
  if (tab === BIRTHDAY_TAB_ALL) {
    return [...celebrants];
  }

  return celebrants.filter((celebrant) => celebrant.affiliation === tab);
}

/** D-5 — 회사 전체 목록(탭과 무관)에 오늘 생일(`days_offset = 0`)이 1명 이상일 때만 true */
export function shouldFireBirthdayConfetti(
  celebrants: readonly Pick<BirthdayCelebrant, 'days_offset'>[]
): boolean {
  return celebrants.some((celebrant) => celebrant.days_offset === 0);
}

/** D-9 — 남은 날 칩: `D-DAY` / `D-n` / `n일 전` */
export function formatDaysOffsetLabel(daysOffset: number): string {
  if (daysOffset === 0) {
    return 'D-DAY';
  }

  if (daysOffset > 0) {
    return `D-${daysOffset}`;
  }

  return `${Math.abs(daysOffset)}일 전`;
}

const EMPTY_NAME_FALLBACK = '이름 미설정';

/**
 * D-11 — 오늘 생일 헤더 문구. 오늘 생일이 없으면 null.
 * 1명: 「오늘은 {이름}님의 생일이에요!」 · 2명 이상: 「오늘은 {첫 이름}님 외 {N}명의 생일이에요!」
 * 「첫 이름」은 넘겨준 목록 순서 기준(정렬된 목록을 넘기면 가나다 첫 사람).
 */
export function buildTodayBirthdayHeadline(
  celebrants: readonly Pick<BirthdayCelebrant, 'days_offset' | 'full_name'>[]
): string | null {
  const today = celebrants.filter((celebrant) => celebrant.days_offset === 0);
  if (today.length === 0) {
    return null;
  }

  const firstName = today[0].full_name.trim() || EMPTY_NAME_FALLBACK;
  if (today.length === 1) {
    return `오늘은 ${firstName}님의 생일이에요!`;
  }

  return `오늘은 ${firstName}님 외 ${today.length - 1}명의 생일이에요!`;
}

/** D-5 — 브라우저당 하루 1번 컨페티 `localStorage` 키 접두사 */
export const BIRTHDAY_CONFETTI_STORAGE_KEY_PREFIX = 'wakeone:birthday-confetti:';

export function getBirthdayConfettiStorageKey(referenceDate: string): string {
  return `${BIRTHDAY_CONFETTI_STORAGE_KEY_PREFIX}${referenceDate}`;
}

/** 키를 쓸 때 정리할 「다른 날짜」 컨페티 키인지 (plan 102 In 8) */
export function isStaleBirthdayConfettiStorageKey(key: string, referenceDate: string): boolean {
  return (
    key.startsWith(BIRTHDAY_CONFETTI_STORAGE_KEY_PREFIX) &&
    key !== getBirthdayConfettiStorageKey(referenceDate)
  );
}
