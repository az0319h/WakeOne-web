import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  PUSH_DETACH_RESULTS,
  PUSH_OWNER_HASH_PREFIX,
  PUSH_RESUME_LOCK_TTL_MS,
  PUSH_RESUME_OWNER_STORAGE_KEY,
  PUSH_SUBSCRIPTION_CREATE_SOURCES,
  PUSH_SUBSCRIPTION_DELETE_SOURCES,
  decideDetachOutcome,
  decideDeviceSync,
  decideForcedSignOutOutcome,
  decideResumeOutcome,
  decideSignOutOutcome,
  isPushDetachResult,
  isPushOwnerHash,
  isPushSubscriptionCreateSource,
  isPushSubscriptionDeleteSource,
  isResumeLockActive,
  parseResumeMarker,
  pushOwnerHashInput,
  resumeMarkerAtIso,
  serializeResumeMarker,
  truncatePushOwnerHash
} from '../push-resume-decision.ts';

/**
 * plan 105 AC-19 — 「사건별 동작」·「자동 복구」 결정표.
 * 실행: `node --test src/features/notifications/lib/__tests__/` (Node 24 타입 스트리핑 · `.mjs`인 이유는 기존 테스트와 같다)
 */

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

/** AC-01과 같은 계산식 — sha256('wakeone-push-owner:' + userId) 앞 16자 */
function ownerHash(userId) {
  return createHash('sha256').update(`wakeone-push-owner:${userId}`).digest('hex').slice(0, 16);
}

const HASH_A = ownerHash(USER_A);
const HASH_B = ownerHash(USER_B);

function syncInput(overrides = {}) {
  return {
    pushSupported: true,
    vapidKeyPresent: true,
    permission: 'granted',
    hasSubscription: true,
    marker: null,
    myOwnerHash: HASH_A,
    ...overrides
  };
}

describe('owner hash · 상수', () => {
  it('접두사와 계산식이 AC-01 기대값과 같다 (user id 원문 없음)', () => {
    assert.equal(PUSH_OWNER_HASH_PREFIX, 'wakeone-push-owner:');
    assert.equal(pushOwnerHashInput(USER_A), `wakeone-push-owner:${USER_A}`);
    const digest = createHash('sha256').update(pushOwnerHashInput(USER_A)).digest('hex');
    assert.equal(truncatePushOwnerHash(digest), HASH_A);
    assert.equal(truncatePushOwnerHash(digest.toUpperCase()), HASH_A);
    assert.equal(HASH_A.length, 16);
    assert.ok(isPushOwnerHash(HASH_A));
    assert.ok(!HASH_A.includes(USER_A.slice(0, 8)));
  });

  it('isPushOwnerHash — 16자 소문자 hex만', () => {
    assert.equal(isPushOwnerHash('0123456789abcdef'), true);
    assert.equal(isPushOwnerHash('0123456789ABCDEF'), false);
    assert.equal(isPushOwnerHash('0123456789abcde'), false);
    assert.equal(isPushOwnerHash('0123456789abcdef0'), false);
    assert.equal(isPushOwnerHash(USER_A), false);
    assert.equal(isPushOwnerHash(null), false);
    assert.equal(isPushOwnerHash(undefined), false);
  });

  it('localStorage 키 · source/result 목록 (API 계약)', () => {
    assert.equal(PUSH_RESUME_OWNER_STORAGE_KEY, 'wakeone.push.resume-owner');
    assert.deepEqual([...PUSH_SUBSCRIPTION_CREATE_SOURCES], ['manual', 'auto_resume']);
    assert.deepEqual([...PUSH_SUBSCRIPTION_DELETE_SOURCES], ['manual', 'sign_out', 'forced_sign_out']);
    assert.deepEqual([...PUSH_DETACH_RESULTS], ['detached', 'none', 'mine']);
    assert.equal(isPushSubscriptionCreateSource('auto_resume'), true);
    assert.equal(isPushSubscriptionCreateSource('sign_out'), false);
    assert.equal(isPushSubscriptionCreateSource('nope'), false);
    assert.equal(isPushSubscriptionDeleteSource('forced_sign_out'), true);
    assert.equal(isPushSubscriptionDeleteSource('auto_resume'), false);
    assert.equal(isPushDetachResult('mine'), true);
    assert.equal(isPushDetachResult('other'), false);
  });
});

describe('기기 표시 parse/serialize', () => {
  it('왕복 · ISO 변환', () => {
    const marker = { owner: HASH_A, at: Date.UTC(2026, 9, 29, 7, 0, 0) };
    const raw = serializeResumeMarker(marker);
    assert.deepEqual(JSON.parse(raw), { owner: HASH_A, at: marker.at });
    assert.deepEqual(parseResumeMarker(raw), marker);
    assert.equal(resumeMarkerAtIso(marker), '2026-10-29T07:00:00.000Z');
  });

  it('형식이 틀리면 null (표시 없음으로 취급)', () => {
    for (const raw of [
      null,
      undefined,
      '',
      'not-json',
      'null',
      '[]',
      '"abc"',
      JSON.stringify({ owner: HASH_A }),
      JSON.stringify({ at: 1 }),
      JSON.stringify({ owner: USER_A, at: 1 }),
      JSON.stringify({ owner: HASH_A, at: '1' }),
      JSON.stringify({ owner: HASH_A, at: 0 }),
      JSON.stringify({ owner: HASH_A, at: -5 })
    ]) {
      assert.equal(parseResumeMarker(raw), null, String(raw));
    }
  });
});

describe('다중 탭 잠금', () => {
  const now = 1_000_000;
  it('15초 안이면 잠김 · 지나거나 없거나 이상하면 풀림', () => {
    assert.equal(PUSH_RESUME_LOCK_TTL_MS, 15_000);
    assert.equal(isResumeLockActive(String(now - 1_000), now), true);
    assert.equal(isResumeLockActive(String(now - 14_999), now), true);
    assert.equal(isResumeLockActive(String(now - 15_000), now), false);
    assert.equal(isResumeLockActive(null, now), false);
    assert.equal(isResumeLockActive('', now), false);
    assert.equal(isResumeLockActive('abc', now), false);
    assert.equal(isResumeLockActive(String(now + 60_000), now), false);
  });
});

describe('decideDeviceSync — 대시보드 진입', () => {
  it('푸시 미지원 · VAPID 키 없음 → noop (표시가 나여도)', () => {
    const marker = { owner: HASH_A, at: 1 };
    assert.deepEqual(decideDeviceSync(syncInput({ pushSupported: false, marker })), {
      type: 'noop',
      reason: 'unsupported'
    });
    assert.deepEqual(decideDeviceSync(syncInput({ vapidKeyPresent: false, marker })), {
      type: 'noop',
      reason: 'not_configured'
    });
    assert.deepEqual(decideDeviceSync(syncInput({ vapidKeyPresent: false, marker: null })), {
      type: 'noop',
      reason: 'not_configured'
    });
  });

  describe('표시 owner = 나 (자동 복구)', () => {
    const marker = { owner: HASH_A, at: 1_700_000_000_000 };
    for (const hasSubscription of [true, false]) {
      it(`denied · 통로 ${hasSubscription ? '있음' : '없음'} → 표시 삭제 · 안내 줄 없음 (AC-13)`, () => {
        assert.deepEqual(decideDeviceSync(syncInput({ marker, permission: 'denied', hasSubscription })), {
          type: 'clear_marker',
          reason: 'permission_denied'
        });
      });
      it(`default · 통로 ${hasSubscription ? '있음' : '없음'} → 안내 줄`, () => {
        assert.deepEqual(decideDeviceSync(syncInput({ marker, permission: 'default', hasSubscription })), {
          type: 'show_banner',
          reason: 'permission_default'
        });
      });
    }
    it('granted · 통로 있음 → 재사용 (AC-02 subscribe 0)', () => {
      assert.deepEqual(decideDeviceSync(syncInput({ marker, hasSubscription: true })), {
        type: 'resume',
        reuseExisting: true,
        marker
      });
    });
    it('granted · 통로 없음 → requestPermission 없이 subscribe 1회 (AC-10)', () => {
      assert.deepEqual(decideDeviceSync(syncInput({ marker, hasSubscription: false })), {
        type: 'resume',
        reuseExisting: false,
        marker
      });
    });
    it('표시가 나면 기기 목록 조회 결과와 무관하게 resume (조회 생략)', () => {
      for (const subscriptionIsMine of [true, false, undefined]) {
        assert.equal(decideDeviceSync(syncInput({ marker, subscriptionIsMine })).type, 'resume');
      }
    });
  });

  describe('표시 owner = 다른 사람', () => {
    const marker = { owner: HASH_B, at: 1 };
    for (const permission of ['default', 'denied', 'granted']) {
      for (const hasSubscription of [true, false]) {
        for (const subscriptionIsMine of [true, false, undefined]) {
          it(`${permission} · 통로 ${hasSubscription} · mine ${subscriptionIsMine} → noop (AC-04 · AC-06)`, () => {
            assert.deepEqual(
              decideDeviceSync(syncInput({ marker, permission, hasSubscription, subscriptionIsMine })),
              { type: 'noop', reason: 'marker_other_owner' }
            );
          });
        }
      }
    }
  });

  describe('표시 없음', () => {
    for (const permission of ['default', 'denied', 'granted']) {
      it(`${permission} · 통로 없음 → noop`, () => {
        assert.deepEqual(decideDeviceSync(syncInput({ permission, hasSubscription: false })), {
          type: 'noop',
          reason: 'no_channel'
        });
      });
      it(`${permission} · 통로 있음 · 미조회 → check_ownership`, () => {
        assert.deepEqual(decideDeviceSync(syncInput({ permission })), { type: 'check_ownership' });
      });
      it(`${permission} · 통로 있음 · 내 기기 → noop (AC-03)`, () => {
        assert.deepEqual(decideDeviceSync(syncInput({ permission, subscriptionIsMine: true })), {
          type: 'noop',
          reason: 'channel_mine'
        });
      });
      it(`${permission} · 통로 있음 · 내 기기 아님 → detach (AC-07 · AC-09)`, () => {
        assert.deepEqual(decideDeviceSync(syncInput({ permission, subscriptionIsMine: false })), {
          type: 'detach'
        });
      });
    }
  });
});

describe('decideResumeOutcome — 자동 복구 POST 결과', () => {
  it('201 · 200 → 표시 삭제 · 토스트 1회 · 기기 새로고침', () => {
    for (const status of [201, 200]) {
      assert.deepEqual(decideResumeOutcome({ kind: 'http', status }), {
        clearMarker: true,
        showBanner: false,
        toastSuccess: true,
        refreshDevices: true
      });
    }
  });
  it('409 (비활성화 이력 · 다른 계정 소유) → 표시 삭제 · 안내 없음', () => {
    assert.deepEqual(decideResumeOutcome({ kind: 'http', status: 409 }), {
      clearMarker: true,
      showBanner: false,
      toastSuccess: false,
      refreshDevices: false
    });
  });
  it('503 → 조용히 · 표시 유지', () => {
    assert.deepEqual(decideResumeOutcome({ kind: 'http', status: 503 }), {
      clearMarker: false,
      showBanner: false,
      toastSuccess: false,
      refreshDevices: false
    });
  });
  it('그 밖의 실패 · 네트워크 · subscribe 실패 → 안내 줄 · 표시 유지 (AC-11)', () => {
    const banner = { clearMarker: false, showBanner: true, toastSuccess: false, refreshDevices: false };
    for (const status of [400, 401, 403, 404, 500, 502]) {
      assert.deepEqual(decideResumeOutcome({ kind: 'http', status }), banner, String(status));
    }
    assert.deepEqual(decideResumeOutcome({ kind: 'network_error' }), banner);
    assert.deepEqual(decideResumeOutcome({ kind: 'subscribe_failed' }), banner);
  });
});

describe('decideDetachOutcome — 이전 사람 연결 끊기', () => {
  it('detached → 이전 주인 hash로 표시 기록 · 통로 유지 (AC-07)', () => {
    assert.deepEqual(decideDetachOutcome({ kind: 'ok', result: 'detached', previousOwnerHash: HASH_A }), {
      writeMarkerOwner: HASH_A,
      unsubscribeChannel: false,
      refreshDevices: true
    });
  });
  it('detached인데 hash가 이상하면 표시를 쓰지 않는다', () => {
    for (const previousOwnerHash of [undefined, null, '', USER_A, 'ZZZZZZZZZZZZZZZZ']) {
      assert.equal(
        decideDetachOutcome({ kind: 'ok', result: 'detached', previousOwnerHash }).writeMarkerOwner,
        null
      );
    }
  });
  it('none → 주인 없는 통로 해제 (AC-09)', () => {
    assert.deepEqual(decideDetachOutcome({ kind: 'ok', result: 'none' }), {
      writeMarkerOwner: null,
      unsubscribeChannel: true,
      refreshDevices: false
    });
  });
  it('mine → 변경 없음', () => {
    assert.deepEqual(decideDetachOutcome({ kind: 'ok', result: 'mine' }), {
      writeMarkerOwner: null,
      unsubscribeChannel: false,
      refreshDevices: true
    });
  });
  it('HTTP 실패 · 네트워크 → 아무것도 안 함', () => {
    const quiet = { writeMarkerOwner: null, unsubscribeChannel: false, refreshDevices: false };
    for (const status of [400, 401, 500]) {
      assert.deepEqual(decideDetachOutcome({ kind: 'http_error', status }), quiet);
    }
    assert.deepEqual(decideDetachOutcome({ kind: 'network_error' }), quiet);
  });
});

describe('decideSignOutOutcome — 로그아웃 버튼 (reason user)', () => {
  it('통로 없음 → 호출·변경 없음', () => {
    assert.deepEqual(decideSignOutOutcome({ kind: 'no_subscription' }), {
      unsubscribeChannel: false,
      writeMarkerSelf: false,
      clearOwnMarker: false
    });
  });
  it('DELETE 200 → 통로 유지 · 표시 = 나 (AC-01)', () => {
    assert.deepEqual(decideSignOutOutcome({ kind: 'http', status: 200 }), {
      unsubscribeChannel: false,
      writeMarkerSelf: true,
      clearOwnMarker: false
    });
  });
  it('DELETE 404 → 통로·표시 그대로 (AC-05)', () => {
    assert.deepEqual(decideSignOutOutcome({ kind: 'http', status: 404 }), {
      unsubscribeChannel: false,
      writeMarkerSelf: false,
      clearOwnMarker: false
    });
  });
  it('그 밖의 실패 · 2초 초과 · 네트워크 → 통로 해제 · 표시 기록 안 함 (AC-16)', () => {
    const safe = { unsubscribeChannel: true, writeMarkerSelf: false, clearOwnMarker: false };
    for (const status of [400, 401, 403, 500, 503]) {
      assert.deepEqual(decideSignOutOutcome({ kind: 'http', status }), safe, String(status));
    }
    assert.deepEqual(decideSignOutOutcome({ kind: 'timeout' }), safe);
    assert.deepEqual(decideSignOutOutcome({ kind: 'network_error' }), safe);
  });
});

describe('decideForcedSignOutOutcome — 강제 로그아웃 (reason forced)', () => {
  it('표시가 나면 삭제 · 통로 해제 (AC-15)', () => {
    assert.deepEqual(decideForcedSignOutOutcome({ owner: HASH_A, at: 1 }, HASH_A), {
      unsubscribeChannel: true,
      writeMarkerSelf: false,
      clearOwnMarker: true
    });
  });
  it('표시가 남이거나 없으면 표시는 그대로 · 통로 해제', () => {
    assert.deepEqual(decideForcedSignOutOutcome({ owner: HASH_B, at: 1 }, HASH_A), {
      unsubscribeChannel: true,
      writeMarkerSelf: false,
      clearOwnMarker: false
    });
    assert.deepEqual(decideForcedSignOutOutcome(null, HASH_A), {
      unsubscribeChannel: true,
      writeMarkerSelf: false,
      clearOwnMarker: false
    });
  });
});

/**
 * plan §Q3 처리 「시나리오 점검」 표 — 결정 함수만으로 기기 1대(표시·통로)와 서버 행을 흉내 낸다.
 * 서버 규칙: POST manual = endpoint upsert(이동) · DELETE = 내 행만 · detach = 다른 계정 행 삭제 ·
 * auto_resume POST = 다른 계정 소유 409 / 비활성화 이력 409 / 그 밖 upsert.
 */
describe('시나리오 (기기 1대 흉내)', () => {
  const ENDPOINT = 'https://e2e.invalid/push/ok/device-1';

  function createWorld() {
    return {
      /** endpoint → user id */
      rows: new Map(),
      device: { marker: null, endpoint: null, permission: 'granted' },
      deactivatedAfterMarker: new Set(),
      toasts: 0,
      banner: false,
      log: []
    };
  }

  function hashOf(userId) {
    return ownerHash(userId);
  }

  function manualEnable(world, userId) {
    world.device.endpoint ??= ENDPOINT;
    world.rows.set(world.device.endpoint, userId);
    world.device.marker = null; // In 4 — ON 성공 시 표시 삭제
  }

  function signOutButton(world, userId) {
    if (!world.device.endpoint) {
      return decideSignOutOutcome({ kind: 'no_subscription' });
    }
    const status = world.rows.get(world.device.endpoint) === userId ? 200 : 404;
    if (status === 200) world.rows.delete(world.device.endpoint);
    const outcome = decideSignOutOutcome({ kind: 'http', status });
    if (outcome.writeMarkerSelf) world.device.marker = { owner: hashOf(userId), at: 1 };
    if (outcome.unsubscribeChannel) world.device.endpoint = null;
    world.log.push(`signout:${status}`);
    return outcome;
  }

  /** 버튼 없이 세션이 끊김(쿠키 삭제·만료) — 아무 코드도 돌지 않는다 */
  function sessionLost() {}

  function enterDashboard(world, userId) {
    const base = {
      pushSupported: true,
      vapidKeyPresent: true,
      permission: world.device.permission,
      hasSubscription: Boolean(world.device.endpoint),
      marker: world.device.marker,
      myOwnerHash: hashOf(userId)
    };
    let decision = decideDeviceSync(base);
    if (decision.type === 'check_ownership') {
      world.log.push('get:preferences');
      decision = decideDeviceSync({
        ...base,
        subscriptionIsMine: world.rows.get(world.device.endpoint) === userId
      });
    }

    if (decision.type === 'clear_marker') world.device.marker = null;
    if (decision.type === 'show_banner') world.banner = true;

    if (decision.type === 'resume') {
      world.device.endpoint ??= ENDPOINT;
      const owner = world.rows.get(world.device.endpoint);
      let status;
      if (owner && owner !== userId) status = 409;
      else if (world.deactivatedAfterMarker.has(userId)) status = 409;
      else {
        status = owner === userId ? 200 : 201;
        world.rows.set(world.device.endpoint, userId);
      }
      world.log.push(`post:auto_resume:${status}`);
      const outcome = decideResumeOutcome({ kind: 'http', status });
      if (outcome.clearMarker) world.device.marker = null;
      if (outcome.toastSuccess) world.toasts += 1;
      if (outcome.showBanner) world.banner = true;
    }

    if (decision.type === 'detach') {
      const owner = world.rows.get(world.device.endpoint);
      let attempt;
      if (!owner) attempt = { kind: 'ok', result: 'none' };
      else if (owner === userId) attempt = { kind: 'ok', result: 'mine' };
      else {
        world.rows.delete(world.device.endpoint);
        attempt = { kind: 'ok', result: 'detached', previousOwnerHash: hashOf(owner) };
      }
      world.log.push(`detach:${attempt.result}`);
      const outcome = decideDetachOutcome(attempt);
      if (outcome.writeMarkerOwner) world.device.marker = { owner: outcome.writeMarkerOwner, at: 2 };
      if (outcome.unsubscribeChannel) world.device.endpoint = null;
    }
    return decision;
  }

  function isOn(world, userId) {
    return Boolean(world.device.endpoint) && world.rows.get(world.device.endpoint) === userId;
  }

  it('A 켬 → A 로그아웃 → A 로그인 → 자동 복구 (AC-01·02) · 새로고침 2회 추가 호출 없음 (AC-03)', () => {
    const world = createWorld();
    manualEnable(world, USER_A);
    signOutButton(world, USER_A);
    assert.equal(world.device.marker.owner, HASH_A);
    assert.equal(world.device.endpoint, ENDPOINT);
    assert.equal(world.rows.size, 0);

    enterDashboard(world, USER_A);
    assert.equal(world.toasts, 1);
    assert.equal(world.device.marker, null);
    assert.ok(isOn(world, USER_A));

    world.log.length = 0;
    enterDashboard(world, USER_A);
    enterDashboard(world, USER_A);
    assert.deepEqual(world.log, ['get:preferences', 'get:preferences']);
    assert.equal(world.toasts, 1);
  });

  it('A 켬 → A 로그아웃 → B 로그인(안 켬) → B 로그아웃 → A 로그인 → 복구 (AC-04·05)', () => {
    const world = createWorld();
    manualEnable(world, USER_A);
    signOutButton(world, USER_A);
    enterDashboard(world, USER_B);
    assert.ok(!isOn(world, USER_B));
    assert.equal(world.device.marker.owner, HASH_A);
    assert.ok(!world.log.some((entry) => entry.startsWith('post') || entry.startsWith('detach')));

    signOutButton(world, USER_B);
    assert.equal(world.log.at(-1), 'signout:404');
    assert.equal(world.device.endpoint, ENDPOINT);
    assert.equal(world.device.marker.owner, HASH_A);

    enterDashboard(world, USER_A);
    assert.ok(isOn(world, USER_A));
    assert.equal(world.toasts, 1);
  });

  it('A 켬 → A 로그아웃 → B 로그인 → B 켬 → B 로그아웃 → A 로그인 → 복구 안 함 (AC-06 · D-2)', () => {
    const world = createWorld();
    manualEnable(world, USER_A);
    signOutButton(world, USER_A);
    enterDashboard(world, USER_B);
    manualEnable(world, USER_B);
    assert.equal(world.device.marker, null);
    signOutButton(world, USER_B);
    assert.equal(world.device.marker.owner, HASH_B);

    world.log.length = 0;
    enterDashboard(world, USER_A);
    assert.deepEqual(world.log, []);
    assert.ok(!isOn(world, USER_A));
    assert.equal(world.toasts, 0);
  });

  it('A 켬 → 버튼 없이 세션 끊김 → B 로그인 → detach → A 로그인 → 복구 (AC-07 · D-4)', () => {
    const world = createWorld();
    manualEnable(world, USER_A);
    sessionLost();
    enterDashboard(world, USER_B);
    assert.ok(world.log.includes('detach:detached'));
    assert.equal(world.rows.size, 0);
    assert.equal(world.device.marker.owner, HASH_A);
    assert.equal(world.device.endpoint, ENDPOINT);
    assert.ok(!isOn(world, USER_B));

    enterDashboard(world, USER_A);
    assert.ok(isOn(world, USER_A));
    assert.equal(world.toasts, 1);
  });

  it('A 켬 → 버튼 없이 세션 끊김 → A 다시 로그인 → 이미 on · POST 없음', () => {
    const world = createWorld();
    manualEnable(world, USER_A);
    sessionLost();
    world.log.length = 0;
    enterDashboard(world, USER_A);
    assert.deepEqual(world.log, ['get:preferences']);
    assert.ok(isOn(world, USER_A));
  });

  it('B 켬 → B 세션 만료 → A 로그인 → detach · 표시 B · A는 off (D-2)', () => {
    const world = createWorld();
    manualEnable(world, USER_B);
    sessionLost();
    enterDashboard(world, USER_A);
    assert.equal(world.device.marker.owner, HASH_B);
    assert.ok(!isOn(world, USER_A));
    world.log.length = 0;
    enterDashboard(world, USER_A);
    assert.deepEqual(world.log, []);
  });

  it('주인 없는 통로(B 로그인 · 표시 없음 · 행 없음) → detach none → 통로 해제 → 새로고침 호출 0 (AC-09)', () => {
    const world = createWorld();
    world.device.endpoint = ENDPOINT;
    enterDashboard(world, USER_B);
    assert.ok(world.log.includes('detach:none'));
    assert.equal(world.device.endpoint, null);
    world.log.length = 0;
    enterDashboard(world, USER_B);
    assert.deepEqual(world.log, []);
  });

  it('표시 A 남은 채 비활성화 → 재활성화 → A 로그인 → 409 · 표시 삭제 · off (D-5 ①)', () => {
    const world = createWorld();
    manualEnable(world, USER_A);
    signOutButton(world, USER_A);
    world.deactivatedAfterMarker.add(USER_A);
    enterDashboard(world, USER_A);
    assert.ok(world.log.includes('post:auto_resume:409'));
    assert.equal(world.device.marker, null);
    assert.equal(world.toasts, 0);
    assert.equal(world.banner, false);
    assert.ok(!isOn(world, USER_A));
  });

  it('표시가 꼬여 다른 계정 행이 있는 통로로 auto_resume → 409 · 이동 금지 (AC-14 ④)', () => {
    const world = createWorld();
    world.device.endpoint = ENDPOINT;
    world.rows.set(ENDPOINT, USER_B);
    world.device.marker = { owner: HASH_A, at: 1 };
    enterDashboard(world, USER_A);
    assert.ok(world.log.includes('post:auto_resume:409'));
    assert.equal(world.rows.get(ENDPOINT), USER_B);
    assert.equal(world.device.marker, null);
  });

  it('권한 default로 초기화 → 안내 줄 · 표시 유지', () => {
    const world = createWorld();
    manualEnable(world, USER_A);
    signOutButton(world, USER_A);
    world.device.permission = 'default';
    enterDashboard(world, USER_A);
    assert.equal(world.banner, true);
    assert.equal(world.device.marker.owner, HASH_A);
    assert.ok(!world.log.some((entry) => entry.startsWith('post')));
  });
});
