/**
 * plan 105 — 로그아웃 후 같은 계정 재로그인 시 휴대폰 알림 자동 복구 · **순수 결정 모듈**.
 *
 * - import 없음 (`node --test src/features/notifications/lib/__tests__/` 대상 · 경로 alias 금지).
 * - 서버(`push-subscriptions.server.ts` · node:crypto)와 클라이언트(`push-resume.ts` · Web Crypto)가
 *   같은 접두사·길이로 기기 표시 owner hash를 만든다.
 * - 브라우저 API·`localStorage`·fetch는 호출부(FE)가 맡고, 여기서는 「무엇을 할지」만 정한다.
 *   plan §동작 설계 「사건별 동작」·「자동 복구」 표가 이 파일의 기준이다.
 */

// ---------------------------------------------------------------------------
// 상수 · API 계약 값 (Route zod 스키마와 FE가 같은 배열을 쓴다)
// ---------------------------------------------------------------------------

/** 기기 표시 `localStorage` 키 — 값 JSON `{"owner":"<16자 hex>","at":<ms epoch>}` */
export const PUSH_RESUME_OWNER_STORAGE_KEY = 'wakeone.push.resume-owner';
/** 여러 탭 동시 진입 잠금 키 — 값 = 잠금 시각(ms epoch) 문자열 */
export const PUSH_RESUME_LOCK_STORAGE_KEY = 'wakeone.push.resume-lock';
export const PUSH_RESUME_LOCK_TTL_MS = 15_000;
/** 프로필이 열려 있으면 `usePushDeviceStatus.refresh()`를 다시 부르도록 보내는 창 이벤트 */
export const PUSH_DEVICE_CHANGED_EVENT = 'wakeone:push-device-changed';

/** owner hash = sha256(PUSH_OWNER_HASH_PREFIX + user_id) hex 앞 16자 */
export const PUSH_OWNER_HASH_PREFIX = 'wakeone-push-owner:';
export const PUSH_OWNER_HASH_LENGTH = 16;

/** `POST /api/notifications/push/subscriptions` body `source` (기본 `manual`) */
export const PUSH_SUBSCRIPTION_CREATE_SOURCES = ['manual', 'auto_resume'] as const;
export type PushSubscriptionCreateSource = (typeof PUSH_SUBSCRIPTION_CREATE_SOURCES)[number];

/** `DELETE /api/notifications/push/subscriptions` body `source` (기본 `manual`) */
export const PUSH_SUBSCRIPTION_DELETE_SOURCES = ['manual', 'sign_out', 'forced_sign_out'] as const;
export type PushSubscriptionDeleteSource = (typeof PUSH_SUBSCRIPTION_DELETE_SOURCES)[number];

/** `POST /api/notifications/push/subscriptions/detach` 응답 `result` */
export const PUSH_DETACH_RESULTS = ['detached', 'none', 'mine'] as const;
export type PushDetachResult = (typeof PUSH_DETACH_RESULTS)[number];

/** `auto_resume` POST 409 사유 (응답 message는 한국어 · 로그 metadata `reason`은 이 값) */
export const PUSH_RESUME_BLOCK_REASONS = ['owned_by_other', 'deactivated_after_marker'] as const;
export type PushResumeBlockReason = (typeof PUSH_RESUME_BLOCK_REASONS)[number];

export function isPushSubscriptionCreateSource(value: unknown): value is PushSubscriptionCreateSource {
  return typeof value === 'string' && (PUSH_SUBSCRIPTION_CREATE_SOURCES as readonly string[]).includes(value);
}

export function isPushSubscriptionDeleteSource(value: unknown): value is PushSubscriptionDeleteSource {
  return typeof value === 'string' && (PUSH_SUBSCRIPTION_DELETE_SOURCES as readonly string[]).includes(value);
}

export function isPushDetachResult(value: unknown): value is PushDetachResult {
  return typeof value === 'string' && (PUSH_DETACH_RESULTS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// owner hash · 기기 표시(marker)
// ---------------------------------------------------------------------------

/** hash 입력 문자열 — 서버·클라이언트가 이 함수 결과를 sha256 한다 */
export function pushOwnerHashInput(userId: string): string {
  return `${PUSH_OWNER_HASH_PREFIX}${userId}`;
}

/** sha256 hex digest(64자) → 앞 16자 소문자 */
export function truncatePushOwnerHash(hexDigest: string): string {
  return hexDigest.toLowerCase().slice(0, PUSH_OWNER_HASH_LENGTH);
}

export function isPushOwnerHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
}

export type PushResumeMarker = {
  /** 「다음 로그인 때 자동 복구할 계정」 owner hash (user id 원문 금지) */
  owner: string;
  /** 표시를 남긴 시각(ms epoch) — 자동 복구 POST `resume_marker_at`의 근거 */
  at: number;
};

/** `localStorage` 원문 → 표시. 형식이 틀리면 null(= 표시 없음으로 취급) */
export function parseResumeMarker(raw: string | null | undefined): PushResumeMarker | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as { owner?: unknown; at?: unknown };
  if (!isPushOwnerHash(candidate.owner)) return null;
  if (typeof candidate.at !== 'number' || !Number.isFinite(candidate.at) || candidate.at <= 0) return null;
  return { owner: candidate.owner, at: candidate.at };
}

export function serializeResumeMarker(marker: PushResumeMarker): string {
  return JSON.stringify({ owner: marker.owner, at: marker.at });
}

/** 표시 시각 → POST `resume_marker_at` ISO 문자열 */
export function resumeMarkerAtIso(marker: PushResumeMarker): string {
  return new Date(marker.at).toISOString();
}

// ---------------------------------------------------------------------------
// 다중 탭 잠금 (localStorage 15초)
// ---------------------------------------------------------------------------

/** 잠금 원문(ms epoch 문자열)이 아직 유효하면 true — 이 탭은 POST·토스트를 건너뛴다 */
export function isResumeLockActive(
  raw: string | null | undefined,
  now: number,
  ttlMs: number = PUSH_RESUME_LOCK_TTL_MS
): boolean {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  const lockedAt = Number(raw);
  if (!Number.isFinite(lockedAt)) return false;
  // 미래 시각(시계 변경 등)은 잠금으로 보지 않는다 — 영구 잠금 방지
  if (lockedAt > now) return false;
  return now - lockedAt < ttlMs;
}

// ---------------------------------------------------------------------------
// 대시보드 진입 동기화 결정 (PushResumeSync)
// ---------------------------------------------------------------------------

export type PushPermissionState = 'default' | 'denied' | 'granted';

export type DeviceSyncInput = {
  /** `isPushSupported()` */
  pushSupported: boolean;
  /** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 존재 */
  vapidKeyPresent: boolean;
  permission: PushPermissionState;
  /** `pushManager.getSubscription()` 결과가 있음(브라우저 통로) */
  hasSubscription: boolean;
  /** `parseResumeMarker(localStorage)` 결과 */
  marker: PushResumeMarker | null;
  /** 지금 로그인한 계정의 owner hash */
  myOwnerHash: string;
  /**
   * 통로 hash ∈ **내** 서버 기기 목록(GET preferences `devices[].endpoint_hash`).
   * 아직 조회 안 했으면 `undefined` → 결정이 `check_ownership`이면 조회 후 다시 호출한다.
   * (표시가 없고 통로가 있을 때만 조회 — PC 대부분은 0회)
   */
  subscriptionIsMine?: boolean;
};

export type DeviceSyncNoopReason =
  | 'unsupported'
  | 'not_configured'
  | 'marker_other_owner'
  | 'no_channel'
  | 'channel_mine';

export type DeviceSyncDecision =
  /** 아무것도 하지 않는다 */
  | { type: 'noop'; reason: DeviceSyncNoopReason }
  /** 권한 차단 — 표시 삭제 · 안내 줄 없음 (프로필이 「알림이 차단되어 있어요…」를 보여 준다) */
  | { type: 'clear_marker'; reason: 'permission_denied' }
  /** 권한이 초기화됨(default) — 안내 줄. 「다시 켜기」(사용자 제스처)가 권한 요청 + 구독을 한다 */
  | { type: 'show_banner'; reason: 'permission_default' }
  /**
   * 자동 복구 — `requestPermission()` **호출 금지**.
   * `reuseExisting` true: `getSubscription()` 통로 재사용 · false: granted 경로로 `subscribe()` 1회 시도(실패 → 안내 줄).
   * 이후 POST `{source:'auto_resume', resume_marker_at: resumeMarkerAtIso(marker)}` → `decideResumeOutcome`.
   */
  | { type: 'resume'; reuseExisting: boolean; marker: PushResumeMarker }
  /** 통로가 내 서버 기기인지 모른다 — GET preferences 후 `subscriptionIsMine`을 채워 다시 호출 */
  | { type: 'check_ownership' }
  /** 통로가 내 기기 목록에 없다 — `POST …/subscriptions/detach {endpoint}` → `decideDetachOutcome` */
  | { type: 'detach' };

export function decideDeviceSync(input: DeviceSyncInput): DeviceSyncDecision {
  if (!input.pushSupported) return { type: 'noop', reason: 'unsupported' };
  if (!input.vapidKeyPresent) return { type: 'noop', reason: 'not_configured' };

  const marker = input.marker;
  if (marker) {
    if (marker.owner !== input.myOwnerHash) {
      // 다른 사람 표시 — 그 사람 행은 로그아웃 때 이미 지워졌다. 통로·표시 그대로
      return { type: 'noop', reason: 'marker_other_owner' };
    }
    if (input.permission === 'denied') return { type: 'clear_marker', reason: 'permission_denied' };
    if (input.permission === 'default') return { type: 'show_banner', reason: 'permission_default' };
    return { type: 'resume', reuseExisting: input.hasSubscription, marker };
  }

  if (!input.hasSubscription) return { type: 'noop', reason: 'no_channel' };
  if (input.subscriptionIsMine === undefined) return { type: 'check_ownership' };
  if (input.subscriptionIsMine) return { type: 'noop', reason: 'channel_mine' };
  return { type: 'detach' };
}

// ---------------------------------------------------------------------------
// 자동 복구 결과 (resume 이후)
// ---------------------------------------------------------------------------

export type ResumeAttemptResult =
  /** granted인데 `subscribe()`가 실패(NotAllowedError 등) — POST 전 */
  | { kind: 'subscribe_failed' }
  /** POST 응답 상태 코드 */
  | { kind: 'http'; status: number }
  /** fetch reject(네트워크·abort) */
  | { kind: 'network_error' };

export type ResumeOutcome = {
  /** 표시 키 삭제 */
  clearMarker: boolean;
  /** 안내 줄 표시 */
  showBanner: boolean;
  /** 토스트 「휴대폰 알림을 다시 켰어요」 1회 */
  toastSuccess: boolean;
  /** `pushKeys.all` invalidate + `PUSH_DEVICE_CHANGED_EVENT` */
  refreshDevices: boolean;
};

export function decideResumeOutcome(result: ResumeAttemptResult): ResumeOutcome {
  if (result.kind === 'subscribe_failed' || result.kind === 'network_error') {
    return { clearMarker: false, showBanner: true, toastSuccess: false, refreshDevices: false };
  }
  const { status } = result;
  if (status === 200 || status === 201) {
    return { clearMarker: true, showBanner: false, toastSuccess: true, refreshDevices: true };
  }
  if (status === 409) {
    // 비활성화 이력 · 다른 계정 소유 — 조용히 끝낸다
    return { clearMarker: true, showBanner: false, toastSuccess: false, refreshDevices: false };
  }
  if (status === 503) {
    // 서버 미설정 — 표시 유지 · 조용히
    return { clearMarker: false, showBanner: false, toastSuccess: false, refreshDevices: false };
  }
  return { clearMarker: false, showBanner: true, toastSuccess: false, refreshDevices: false };
}

// ---------------------------------------------------------------------------
// detach 결과 (다른 계정 로그인 시 이전 사람 연결 끊기 · D-4)
// ---------------------------------------------------------------------------

export type DetachAttemptResult =
  | { kind: 'ok'; result: PushDetachResult; previousOwnerHash?: string | null }
  | { kind: 'http_error'; status: number }
  | { kind: 'network_error' };

export type DetachOutcome = {
  /** 이 값으로 표시를 기록한다(이전 주인 hash) · null이면 표시 변경 없음 */
  writeMarkerOwner: string | null;
  /** 브라우저 통로 `subscription.unsubscribe()` (주인 없는 통로 정리) */
  unsubscribeChannel: boolean;
  refreshDevices: boolean;
};

export function decideDetachOutcome(attempt: DetachAttemptResult): DetachOutcome {
  if (attempt.kind !== 'ok') {
    // 실패는 조용히 — 다음 진입 때 다시 시도된다
    return { writeMarkerOwner: null, unsubscribeChannel: false, refreshDevices: false };
  }
  if (attempt.result === 'detached') {
    return {
      writeMarkerOwner: isPushOwnerHash(attempt.previousOwnerHash) ? attempt.previousOwnerHash : null,
      unsubscribeChannel: false,
      refreshDevices: true
    };
  }
  if (attempt.result === 'none') {
    return { writeMarkerOwner: null, unsubscribeChannel: true, refreshDevices: false };
  }
  // mine — 이미 내 기기(목록 조회와 경합) · 변경 없음
  return { writeMarkerOwner: null, unsubscribeChannel: false, refreshDevices: true };
}

// ---------------------------------------------------------------------------
// 로그아웃 (signOut reason)
// ---------------------------------------------------------------------------

export type SignOutDeleteResult =
  /** 브라우저 통로 없음 — DELETE 호출 없음 */
  | { kind: 'no_subscription' }
  | { kind: 'http'; status: number }
  /** 네트워크 오류 · abort */
  | { kind: 'network_error' }
  /** 2초 초과 */
  | { kind: 'timeout' };

export type SignOutOutcome = {
  /** 브라우저 통로 해제 (안전장치) */
  unsubscribeChannel: boolean;
  /** 표시를 「나」로 기록 */
  writeMarkerSelf: boolean;
  /** 표시가 「나」면 삭제 */
  clearOwnMarker: boolean;
};

/** 로그아웃 버튼(`reason:'user'`) — DELETE `{source:'sign_out'}` 결과 */
export function decideSignOutOutcome(result: SignOutDeleteResult): SignOutOutcome {
  if (result.kind === 'no_subscription') {
    return { unsubscribeChannel: false, writeMarkerSelf: false, clearOwnMarker: false };
  }
  if (result.kind === 'http' && result.status === 200) {
    return { unsubscribeChannel: false, writeMarkerSelf: true, clearOwnMarker: false };
  }
  if (result.kind === 'http' && result.status === 404) {
    // 내 행 아님 — 보낼 대상이 없다. 통로·표시 그대로
    return { unsubscribeChannel: false, writeMarkerSelf: false, clearOwnMarker: false };
  }
  // 그 밖의 실패·timeout·네트워크 오류 — 서버 행이 남았을 수 있으니 통로까지 해제(410으로 정리됨)
  return { unsubscribeChannel: true, writeMarkerSelf: false, clearOwnMarker: false };
}

/** 강제 로그아웃(`reason:'forced'` · 비활성화 감지) — 91 동작(DELETE `forced_sign_out` + 통로 해제) + 내 표시 삭제 */
export function decideForcedSignOutOutcome(
  marker: PushResumeMarker | null,
  myOwnerHash: string
): SignOutOutcome {
  return {
    unsubscribeChannel: true,
    writeMarkerSelf: false,
    clearOwnMarker: marker !== null && marker.owner === myOwnerHash
  };
}
