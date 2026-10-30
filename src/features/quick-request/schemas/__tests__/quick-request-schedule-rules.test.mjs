import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as z from 'zod';
import {
  getQuickRequestScheduleIssues,
  QUICK_REQUEST_SCHEDULE_BODY_PATHS,
  QUICK_REQUEST_SCHEDULE_CLIENT_GRACE_MS,
  QUICK_REQUEST_SCHEDULE_FORM_PATHS,
  QUICK_REQUEST_SCHEDULE_MESSAGES,
  QUICK_REQUEST_SCHEDULE_SERVER_GRACE_MS,
  quickRequestScheduleTimesFromBody,
  refineQuickRequestCreateSchedule,
  refineQuickRequestScheduleOrder
} from '../quick-request-schedule-rules.ts';

/**
 * plan 106 D-11 · F-9 · AC-26 · AC-27 — 실행: `node --test src/features/quick-request/schemas/__tests__/`
 */

const NOW = Date.parse('2026-10-29T03:00:00.000Z');
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const iso = (ms) => new Date(ms).toISOString();

const scheduleSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.enum(['immediate', 'asap']) }),
  z.object({ mode: z.literal('scheduled'), datetimeIso: z.string().datetime() })
]);

/** 서버 등록 body 모양만 흉내 낸 스키마 (`@/` import가 있는 workflow.ts 대신) */
const createLikeSchema = z
  .object({
    origin: z.object({ schedule: scheduleSchema }),
    destination: z.object({ schedule: scheduleSchema })
  })
  .superRefine((data, ctx) => refineQuickRequestCreateSchedule(data, ctx, { now: NOW }));

function body(origin, destination) {
  return {
    origin: { schedule: origin == null ? { mode: 'immediate' } : { mode: 'scheduled', datetimeIso: iso(origin) } },
    destination: {
      schedule: destination == null ? { mode: 'asap' } : { mode: 'scheduled', datetimeIso: iso(destination) }
    }
  };
}

function errorsOf(result) {
  const errors = {};
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.join('.');
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

describe('문구·상수 (D-11)', () => {
  it('문구 3종 그대로', () => {
    assert.deepEqual(QUICK_REQUEST_SCHEDULE_MESSAGES, {
      originPast: '픽업 일시는 현재 이후로 선택해 주세요.',
      destinationPast: '도착 희망 일시는 현재 이후로 선택해 주세요.',
      destinationBeforeOrigin: '도착 희망 일시는 픽업 일시 이후로 선택해 주세요.'
    });
  });

  it('서버 5분 여유 · 클라이언트 여유는 서버보다 작다', () => {
    assert.equal(QUICK_REQUEST_SCHEDULE_SERVER_GRACE_MS, 5 * MIN);
    assert.ok(QUICK_REQUEST_SCHEDULE_CLIENT_GRACE_MS < QUICK_REQUEST_SCHEDULE_SERVER_GRACE_MS);
  });
});

describe('getQuickRequestScheduleIssues (순수 함수)', () => {
  const run = (originMs, destinationMs, graceMs = 0) =>
    getQuickRequestScheduleIssues(
      {
        originAtIso: originMs == null ? null : iso(originMs),
        destinationAtIso: destinationMs == null ? null : iso(destinationMs)
      },
      { now: NOW, graceMs }
    );

  it('① 픽업 지금 −1시간 → origin 「픽업 일시는 현재 이후로…」', () => {
    assert.deepEqual(run(NOW - HOUR, null), [
      { field: 'origin', message: QUICK_REQUEST_SCHEDULE_MESSAGES.originPast }
    ]);
  });

  it('② 픽업 +2시간 · 도착 +1시간 → destination 「픽업 일시 이후로…」', () => {
    assert.deepEqual(run(NOW + 2 * HOUR, NOW + HOUR), [
      { field: 'destination', message: QUICK_REQUEST_SCHEDULE_MESSAGES.destinationBeforeOrigin }
    ]);
  });

  it('③ 픽업 즉시 · 도착 −1시간 → destination 「현재 이후로…」', () => {
    assert.deepEqual(run(null, NOW - HOUR), [
      { field: 'destination', message: QUICK_REQUEST_SCHEDULE_MESSAGES.destinationPast }
    ]);
  });

  it('④ 픽업 +1시간 · 도착 +3시간 → 통과', () => {
    assert.deepEqual(run(NOW + HOUR, NOW + 3 * HOUR), []);
  });

  it('즉시·최대한 빠르게는 검사하지 않는다', () => {
    assert.deepEqual(run(null, null), []);
    assert.deepEqual(run(null, NOW + MIN), []);
  });

  it('도착 = 픽업(같은 시각)은 허용', () => {
    assert.deepEqual(run(NOW + HOUR, NOW + HOUR), []);
  });

  it('둘 다 과거 → 필드마다 「현재 이후로」 1개씩 (순서 문구 중복 없음)', () => {
    assert.deepEqual(run(NOW - HOUR, NOW - 2 * HOUR), [
      { field: 'origin', message: QUICK_REQUEST_SCHEDULE_MESSAGES.originPast },
      { field: 'destination', message: QUICK_REQUEST_SCHEDULE_MESSAGES.destinationPast }
    ]);
  });

  it('여유: 지금 −3분은 서버 5분 여유 안 → 통과 · −6분은 거절 · 여유 0이면 −3분도 거절', () => {
    const grace = QUICK_REQUEST_SCHEDULE_SERVER_GRACE_MS;
    assert.deepEqual(run(NOW - 3 * MIN, null, grace), []);
    assert.equal(run(NOW - 6 * MIN, null, grace).length, 1);
    assert.equal(run(NOW - 3 * MIN, null, 0).length, 1);
    assert.deepEqual(run(NOW - grace, null, grace), []);
  });

  it('클라이언트 1분 여유: 같은 분(초 차이) 선택 허용', () => {
    const sameMinute = NOW + 40 * 1000;
    const pickedMinute = NOW; // datetime-local 분 단위 → 초가 잘린 값
    assert.deepEqual(
      getQuickRequestScheduleIssues(
        { originAtIso: iso(pickedMinute), destinationAtIso: null },
        { now: sameMinute, graceMs: QUICK_REQUEST_SCHEDULE_CLIENT_GRACE_MS }
      ),
      []
    );
  });

  it('잘못된 ISO는 건너뛴다 (형식 검사 몫)', () => {
    assert.deepEqual(
      getQuickRequestScheduleIssues({ originAtIso: 'not-a-date', destinationAtIso: '' }, { now: NOW }),
      []
    );
  });

  it('now 생략 시 Date.now() 기준', () => {
    assert.equal(
      getQuickRequestScheduleIssues({ originAtIso: iso(Date.now() - HOUR), destinationAtIso: null }).length,
      1
    );
    assert.deepEqual(
      getQuickRequestScheduleIssues({ originAtIso: iso(Date.now() + HOUR), destinationAtIso: null }),
      []
    );
  });
});

describe('zod 연결 (등록 body · AC-27 errors 경로)', () => {
  it('① 픽업 과거 → errors["origin.schedule"]', () => {
    const result = createLikeSchema.safeParse(body(NOW - HOUR, null));
    assert.equal(result.success, false);
    assert.deepEqual(errorsOf(result), { 'origin.schedule': QUICK_REQUEST_SCHEDULE_MESSAGES.originPast });
  });

  it('② 도착 < 픽업 → errors["destination.schedule"]', () => {
    const result = createLikeSchema.safeParse(body(NOW + 2 * HOUR, NOW + HOUR));
    assert.deepEqual(errorsOf(result), {
      'destination.schedule': QUICK_REQUEST_SCHEDULE_MESSAGES.destinationBeforeOrigin
    });
  });

  it('③ 픽업 지금 −3분(서버 여유 안) → 통과', () => {
    assert.equal(createLikeSchema.safeParse(body(NOW - 3 * MIN, null)).success, true);
  });

  it('즉시·최대한 빠르게 → 통과', () => {
    assert.equal(createLikeSchema.safeParse(body(null, null)).success, true);
  });

  it('quickRequestScheduleTimesFromBody — scheduled만 시각', () => {
    assert.deepEqual(quickRequestScheduleTimesFromBody(body(null, NOW)), {
      originAtIso: null,
      destinationAtIso: iso(NOW)
    });
  });

  it('FE 폼 경로(paths 옵션) → origin.scheduledDatetime', () => {
    const formLike = z.object({ x: z.string() }).superRefine((_, ctx) =>
      refineQuickRequestScheduleOrder(
        { originAtIso: iso(NOW - HOUR), destinationAtIso: null },
        ctx,
        { now: NOW, graceMs: QUICK_REQUEST_SCHEDULE_CLIENT_GRACE_MS, paths: QUICK_REQUEST_SCHEDULE_FORM_PATHS }
      )
    );
    assert.deepEqual(errorsOf(formLike.safeParse({ x: '' })), {
      'origin.scheduledDatetime': QUICK_REQUEST_SCHEDULE_MESSAGES.originPast
    });
    assert.deepEqual(QUICK_REQUEST_SCHEDULE_BODY_PATHS.origin, ['origin', 'schedule']);
  });
});

describe('수정 흐름 무관 (F-9 · AC-27 ④)', () => {
  const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

  it('PATCH 스키마에는 날짜 검사가 없다', () => {
    const source = read('../quick-request-workflow.ts');
    const start = source.indexOf('export const quickRequestPatchBodySchema');
    const end = source.indexOf('.strict();', start);
    assert.ok(start > 0 && end > start, 'quickRequestPatchBodySchema 블록을 찾지 못함');
    const patchBlock = source.slice(start, end);
    assert.doesNotMatch(patchBlock, /Schedule(Order|Issues)|refineQuickRequestCreateSchedule|superRefine/);

    const createStart = source.indexOf('export const quickRequestCreateBodySchema');
    const createBlock = source.slice(createStart, source.indexOf('export type QuickRequestCreateBody', createStart));
    assert.match(createBlock, /refineQuickRequestCreateSchedule\(data, ctx\)/);
  });

  it('요청·수정 공용 refineQuickRequestForm에는 날짜 검사가 없다', () => {
    const source = read('../quick-request-form.ts');
    const start = source.indexOf('export function refineQuickRequestForm');
    const end = source.indexOf('\n}\n', start);
    assert.ok(start > 0 && end > start, 'refineQuickRequestForm 본문을 찾지 못함');
    assert.doesNotMatch(source.slice(start, end), /refineQuickRequestScheduleOrder|getQuickRequestScheduleIssues/);
  });
});
