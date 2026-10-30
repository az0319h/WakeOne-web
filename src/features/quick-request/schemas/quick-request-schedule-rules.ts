import type * as z from 'zod';

/**
 * plan 106 D-11 · F-9 · AC-26 · AC-27 — **등록 전용** 픽업·도착 날짜 검사 (서버 등록 body · FE 등록 폼 공용).
 *
 * 규칙 (필드마다 문구 1개):
 * - 픽업 예약 시각 < 지금 − 여유 → 「픽업 일시는 현재 이후로 선택해 주세요.」 (origin)
 * - 도착 예약 시각 < 지금 − 여유 → 「도착 희망 일시는 현재 이후로 선택해 주세요.」 (destination)
 * - 위가 아니고 둘 다 예약인데 도착 < 픽업 → 「도착 희망 일시는 픽업 일시 이후로 선택해 주세요.」 (destination · 같은 시각 허용)
 * - 즉시 요청(픽업)·최대한 빠르게(도착)는 검사하지 않는다.
 *
 * 수정(동방특송·admin PATCH·수정 Sheet)은 지난 시각을 허용하므로 `refineQuickRequestForm`(요청·수정 공용)과
 * `quickRequestPatchBodySchema`에는 붙이지 않는다.
 *
 * 이 파일은 `@/` alias·server 모듈을 import하지 않는다 — `node --test`에서 직접 불러 쓰기 위함.
 */

export const QUICK_REQUEST_SCHEDULE_MESSAGES = {
  originPast: '픽업 일시는 현재 이후로 선택해 주세요.',
  destinationPast: '도착 희망 일시는 현재 이후로 선택해 주세요.',
  destinationBeforeOrigin: '도착 희망 일시는 픽업 일시 이후로 선택해 주세요.'
} as const;

/** 서버(등록 Route) 여유 — 기기 시계 차이·작성/미리보기 시간 (D-11 「5분 여유」) */
export const QUICK_REQUEST_SCHEDULE_SERVER_GRACE_MS = 5 * 60 * 1000;

/**
 * FE 등록 폼 권장 여유 — `datetime-local`은 분 단위라 「지금」과 같은 분을 고르면 초 차이로 막히지 않게 1분.
 * 서버 여유(5분)보다 작아야 화면 통과 → 서버 거절이 생기지 않는다.
 */
export const QUICK_REQUEST_SCHEDULE_CLIENT_GRACE_MS = 60 * 1000;

export type QuickRequestScheduleField = 'origin' | 'destination';

/** 검사 입력 — 예약이 아니면(즉시·최대한 빠르게) `null` */
export type QuickRequestScheduleTimes = {
  originAtIso: string | null;
  destinationAtIso: string | null;
};

export type QuickRequestScheduleIssue = {
  field: QuickRequestScheduleField;
  message: string;
};

export type QuickRequestScheduleRuleOptions = {
  /** 기준 시각 (기본 `Date.now()`) — 테스트·FE에서 고정할 때 */
  now?: Date | number;
  /** 과거 허용 여유(ms) (기본 0) — 서버는 `QUICK_REQUEST_SCHEDULE_SERVER_GRACE_MS` */
  graceMs?: number;
};

export type QuickRequestScheduleIssuePaths = Record<QuickRequestScheduleField, readonly PropertyKey[]>;

/** 서버 등록 body의 `errors` 키 — `origin.schedule` / `destination.schedule` */
export const QUICK_REQUEST_SCHEDULE_BODY_PATHS: QuickRequestScheduleIssuePaths = {
  origin: ['origin', 'schedule'],
  destination: ['destination', 'schedule']
};

/** FE 등록 폼 입력칸 경로 (`origin.scheduledDatetime` 등 · 기존 「일시를 선택해 주세요」와 같은 칸) */
export const QUICK_REQUEST_SCHEDULE_FORM_PATHS: QuickRequestScheduleIssuePaths = {
  origin: ['origin', 'scheduledDatetime'],
  destination: ['destination', 'scheduledDatetime']
};

function toEpochMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 순수 함수 — 위반 목록(필드마다 최대 1개). 잘못된/빈 ISO는 형식 검사 쪽 몫이라 여기서는 건너뛴다.
 */
export function getQuickRequestScheduleIssues(
  times: QuickRequestScheduleTimes,
  options: QuickRequestScheduleRuleOptions = {}
): QuickRequestScheduleIssue[] {
  const nowMs = options.now === undefined ? Date.now() : new Date(options.now).getTime();
  const graceMs = Math.max(0, options.graceMs ?? 0);
  const earliestMs = nowMs - graceMs;

  const originMs = toEpochMs(times.originAtIso);
  const destinationMs = toEpochMs(times.destinationAtIso);
  const issues: QuickRequestScheduleIssue[] = [];

  if (originMs !== null && originMs < earliestMs) {
    issues.push({ field: 'origin', message: QUICK_REQUEST_SCHEDULE_MESSAGES.originPast });
  }

  if (destinationMs !== null) {
    if (destinationMs < earliestMs) {
      issues.push({ field: 'destination', message: QUICK_REQUEST_SCHEDULE_MESSAGES.destinationPast });
    } else if (originMs !== null && destinationMs < originMs) {
      issues.push({
        field: 'destination',
        message: QUICK_REQUEST_SCHEDULE_MESSAGES.destinationBeforeOrigin
      });
    }
  }

  return issues;
}

/**
 * zod `superRefine` 연결용 — 위반마다 `ctx.addIssue` (기본 경로는 서버 body `origin.schedule`/`destination.schedule`).
 *
 * FE 등록 폼 예:
 * ```ts
 * refineQuickRequestScheduleOrder(
 *   {
 *     originAtIso: data.origin.scheduleMode === 'scheduled' ? localDatetimeInputToIso(data.origin.scheduledDatetime) : null,
 *     destinationAtIso: data.destination.scheduleMode === 'scheduled' ? localDatetimeInputToIso(data.destination.scheduledDatetime) : null
 *   },
 *   ctx,
 *   { graceMs: QUICK_REQUEST_SCHEDULE_CLIENT_GRACE_MS, paths: QUICK_REQUEST_SCHEDULE_FORM_PATHS }
 * );
 * ```
 */
export function refineQuickRequestScheduleOrder(
  times: QuickRequestScheduleTimes,
  ctx: z.RefinementCtx,
  options: QuickRequestScheduleRuleOptions & { paths?: QuickRequestScheduleIssuePaths } = {}
): void {
  const paths = options.paths ?? QUICK_REQUEST_SCHEDULE_BODY_PATHS;
  for (const issue of getQuickRequestScheduleIssues(times, options)) {
    ctx.addIssue({ code: 'custom', message: issue.message, path: [...paths[issue.field]] });
  }
}

type ScheduleBodyLike = {
  origin: { schedule: { mode: string; datetimeIso?: string } };
  destination: { schedule: { mode: string; datetimeIso?: string } };
};

/** 서버 등록 body(`schedule.mode === 'scheduled'`일 때만 시각) → 검사 입력 */
export function quickRequestScheduleTimesFromBody(body: ScheduleBodyLike): QuickRequestScheduleTimes {
  const pick = (schedule: ScheduleBodyLike['origin']['schedule']) =>
    schedule.mode === 'scheduled' ? (schedule.datetimeIso ?? null) : null;
  return {
    originAtIso: pick(body.origin.schedule),
    destinationAtIso: pick(body.destination.schedule)
  };
}

/** `quickRequestCreateBodySchema` 전용 — 서버 시각 · 5분 여유 · `origin.schedule`/`destination.schedule` 경로 */
export function refineQuickRequestCreateSchedule(
  data: ScheduleBodyLike,
  ctx: z.RefinementCtx,
  options: QuickRequestScheduleRuleOptions = {}
): void {
  refineQuickRequestScheduleOrder(quickRequestScheduleTimesFromBody(data), ctx, {
    graceMs: QUICK_REQUEST_SCHEDULE_SERVER_GRACE_MS,
    ...options,
    paths: QUICK_REQUEST_SCHEDULE_BODY_PATHS
  });
}
