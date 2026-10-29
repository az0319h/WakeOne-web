'use client';

import {
  createPushSubscription,
  createPushSubscriptionWithStatus,
  deletePushSubscription,
  detachPushSubscription,
  isPushApiError
} from '../api/push-service';
import type { PushDevice } from '../api/push-types';
import {
  decideDetachOutcome,
  decideResumeOutcome,
  decideSignOutOutcome,
  resumeMarkerAtIso,
  type DetachAttemptResult,
  type DetachOutcome,
  type PushPermissionState,
  type PushResumeMarker,
  type ResumeAttemptResult,
  type ResumeOutcome,
  type SignOutDeleteResult
} from './push-resume-decision';
import { clearResumeMarker, writeResumeMarker } from './push-resume';

/**
 * plan 91 — 브라우저 전용 푸시 유틸. 서버 모듈 import 금지.
 * 모든 판정은 mount 이후(useEffect)에 호출한다 — SSR에서는 `navigator`가 없다.
 */

export type PushDeviceStatus = 'loading' | 'unsupported' | 'not_configured' | 'denied' | 'off' | 'on';

export const IOS_INSTALL_BANNER_DISMISSED_KEY = 'wakeone.push.ios-banner-dismissed-at';
export const IOS_INSTALL_BANNER_DISMISS_DAYS = 7;

const UNSUBSCRIBE_TIMEOUT_MS = 2000;
/** plan 105 — 자동 복구 `subscribe()` 전 SW 활성화 대기 상한 (넘으면 안내 줄) */
const SW_READY_TIMEOUT_MS = 5000;

/**
 * plan 94 D-6 — SW `notificationclick` → 열린 창 `postMessage({ type, url }, [port])` → 앱 `router.push(url)` → `port.postMessage('ack')`.
 * `public/sw.js`의 문자열과 1:1 (SW는 모듈 import가 안 되므로 양쪽에 같은 값을 둔다).
 */
export const SW_NAVIGATE_MESSAGE_TYPE = 'wakeone:navigate';
export const SW_NAVIGATE_ACK = 'ack';

export type SwNavigateMessage = { type: typeof SW_NAVIGATE_MESSAGE_TYPE; url: string };

export function isSwNavigateMessage(value: unknown): value is SwNavigateMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SwNavigateMessage>;
  return candidate.type === SW_NAVIGATE_MESSAGE_TYPE && typeof candidate.url === 'string';
}

/** 같은 origin의 경로만 `pathname+search+hash`로 돌려준다 — 외부 URL·`//host`는 null (SW 메시지는 신뢰하되 한 번 더 거른다) */
export function resolveInternalNavigationPath(url: string, origin: string = window.location.origin): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    typeof window.Notification.requestPermission === 'function'
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export function isIosDevice(userAgent?: string): boolean {
  if (typeof navigator === 'undefined' && !userAgent) return false;
  const ua = userAgent ?? navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ 데스크톱 모드 UA는 Macintosh로 나오지만 터치 포인트가 있다
  return (
    /Macintosh/i.test(ua) && typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1
  );
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** BE `hashEndpoint`와 동일 — sha256 hex 앞 16자 (Web Crypto) */
export async function hashEndpoint(endpoint: string): Promise<string> {
  const data = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/** 「Android · Chrome」「iPhone · Safari」「iPad · Safari」「Windows · Chrome」「Mac · Safari」「알 수 없는 기기」 */
export function summarizeUserAgent(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? '').trim();
  if (!ua) return '알 수 없는 기기';

  let os: string | null = null;
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPod/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser: string | null = null;
  if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Edg\//i.test(ua) || /EdgiOS/i.test(ua) || /EdgA/i.test(ua)) browser = 'Edge';
  else if (/Whale/i.test(ua)) browser = 'Whale';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  if (!os && !browser) return '알 수 없는 기기';
  if (!os) return browser as string;
  if (!browser) return os;
  return `${os} · ${browser}`;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export class PushPermissionDeniedError extends Error {
  constructor() {
    super('알림 권한이 거부되었습니다.');
    this.name = 'PushPermissionDeniedError';
  }
}

/**
 * Switch ON — permission → `pushManager.subscribe` → `POST /api/notifications/push/subscriptions`.
 * 이미 구독이 있으면 재사용한다(멱등).
 */
export async function subscribeThisDevice(): Promise<{ endpoint: string; deviceCount: number }> {
  if (!isPushSupported()) {
    throw new Error('이 브라우저에서는 알림을 켤 수 없어요.');
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('휴대폰 알림 서버 설정이 아직 준비되지 않았습니다.');
  }

  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') {
    throw new PushPermissionDeniedError();
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error('알림 서비스를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
    });
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('구독 정보가 올바르지 않습니다.');
  }

  const result = await createPushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh, auth },
    userAgent: navigator.userAgent,
    // plan 105 — 스위치·안내 줄 「다시 켜기」(사용자 제스처) 경로
    source: 'manual'
  });

  return { endpoint: json.endpoint, deviceCount: result.device_count };
}

/**
 * plan 105 — 자동 복구용 통로 확보. **`Notification.requestPermission()`을 부르지 않는다**
 * (WebKit은 사용자 제스처가 없으면 이미 granted여도 Denied로 끝난다).
 * 1) `getSubscription()`(제스처 불필요) 재사용 → 2) 없으면 권한이 granted일 때만 `subscribe()` 1회.
 * 실패하면 던진다 → 호출부가 `subscribe_failed`(안내 줄)로 처리한다.
 */
export async function subscribeExistingOrGranted(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error('이 브라우저에서는 알림을 켤 수 없어요.');
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('휴대폰 알림 서버 설정이 아직 준비되지 않았습니다.');
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error('알림 서비스를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  if (getNotificationPermission() !== 'granted') {
    throw new Error('알림 권한이 없어 자동으로 다시 켤 수 없어요.');
  }

  const ready = await withTimeout(navigator.serviceWorker.ready, SW_READY_TIMEOUT_MS);
  if (!ready) {
    throw new Error('알림 서비스를 준비할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      }
    );
  });
}

/**
 * 강제 로그아웃(plan 105 `signOut({ reason: 'forced' })` · 비활성화 감지) — `DELETE {endpoint, source:'forced_sign_out'}` → `subscription.unsubscribe()`.
 * plan 91 동작 그대로: 2초 timeout · 모든 실패는 무시한다(로그아웃을 막지 않는다).
 * 일반 로그아웃 버튼은 브라우저 구독을 남기는 `signOutPushOnThisDevice()`를 쓴다.
 */
export async function unsubscribePushOnThisDevice(): Promise<void> {
  if (!isPushSupported()) return;

  await withTimeout(
    (async () => {
      const subscription = await getCurrentPushSubscription();
      if (!subscription) return;

      try {
        await deletePushSubscription({ endpoint: subscription.endpoint, source: 'forced_sign_out' });
      } catch {
        /* 404(이미 해제)·네트워크 오류 무시 */
      }

      try {
        await subscription.unsubscribe();
      } catch {
        /* 브라우저 측 해제 실패 무시 */
      }
    })(),
    UNSUBSCRIBE_TIMEOUT_MS
  );
}

/** Switch OFF(프로필) — 실패를 알려야 하므로 timeout·무시 없이 던진다 */
export async function disablePushOnThisDevice(): Promise<{ deviceCount: number | null }> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return { deviceCount: null };

  let deviceCount: number | null = null;
  try {
    const result = await deletePushSubscription({ endpoint: subscription.endpoint, source: 'manual' });
    deviceCount = result.device_count;
  } catch (error) {
    // 서버에 없는(404) 구독은 브라우저 측만 정리한다
    if (!(error instanceof Error && /찾을 수 없습니다/.test(error.message))) {
      throw error;
    }
  }

  await subscription.unsubscribe();
  return { deviceCount };
}

// ---------------------------------------------------------------------------
// plan 105 — 로그아웃 버튼 · 대시보드 진입 동기화 (결정은 push-resume-decision.ts)
// ---------------------------------------------------------------------------

async function deleteForSignOut(endpoint: string): Promise<SignOutDeleteResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UNSUBSCRIBE_TIMEOUT_MS);
  try {
    await deletePushSubscription({ endpoint, source: 'sign_out' }, { signal: controller.signal });
    return { kind: 'http', status: 200 };
  } catch (error) {
    if (isPushApiError(error)) return { kind: 'http', status: error.status };
    if (controller.signal.aborted) return { kind: 'timeout' };
    return { kind: 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 로그아웃 버튼(`signOut()` · reason `user`) — 서버 등록만 지우고(`DELETE {endpoint, source:'sign_out'}` · 2초)
 * - 200: 브라우저 구독 **유지** + 기기 표시를 「나」로 기록 (같은 계정 재로그인 시 자동 복구)
 * - 404: 내 행 아님 → 구독·표시 그대로
 * - 그 밖의 실패·timeout·네트워크 오류: 서버 행이 남았을 수 있으니 브라우저 구독까지 해제(안전장치)
 * 모든 실패는 삼킨다(로그아웃을 막지 않는다).
 */
export async function signOutPushOnThisDevice(myOwnerHash: string | null): Promise<void> {
  if (!isPushSupported()) return;

  const subscription = await withTimeout(getCurrentPushSubscription(), UNSUBSCRIBE_TIMEOUT_MS);
  const result: SignOutDeleteResult = subscription
    ? await deleteForSignOut(subscription.endpoint)
    : { kind: 'no_subscription' };
  const outcome = decideSignOutOutcome(result);

  // hash를 못 구하면 표시를 남길 수 없다 → 주인 없는 통로를 남기지 않도록 91 동작(구독 해제)으로 떨어진다
  const keepWithoutMarker = outcome.writeMarkerSelf && !myOwnerHash;
  if (outcome.writeMarkerSelf && myOwnerHash) {
    writeResumeMarker(myOwnerHash);
  }

  if (subscription && (outcome.unsubscribeChannel || keepWithoutMarker)) {
    await withTimeout(subscription.unsubscribe(), UNSUBSCRIBE_TIMEOUT_MS);
  }
}

export type PushDeviceSnapshot = {
  pushSupported: boolean;
  vapidKeyPresent: boolean;
  permission: PushPermissionState;
  /** `getSubscription()` 결과 (제스처 불필요) — 미지원·키 없음이면 조회하지 않고 null */
  subscription: PushSubscription | null;
};

/** 대시보드 진입 판정 입력 — 브라우저 API만 읽는다(서버 호출 없음) */
export async function readPushDeviceSnapshot(): Promise<PushDeviceSnapshot> {
  const pushSupported = isPushSupported();
  const vapidKeyPresent = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const rawPermission = getNotificationPermission();
  const permission: PushPermissionState = rawPermission === 'unsupported' ? 'default' : rawPermission;

  if (!pushSupported || !vapidKeyPresent) {
    return { pushSupported, vapidKeyPresent, permission, subscription: null };
  }

  const subscription = await getCurrentPushSubscription();
  return { pushSupported, vapidKeyPresent, permission, subscription };
}

/** 통로 hash ∈ 내 서버 기기 목록 */
export async function isSubscriptionInDevices(
  subscription: PushSubscription,
  devices: PushDevice[]
): Promise<boolean> {
  const endpointHash = await hashEndpoint(subscription.endpoint);
  return findThisDevice(devices, endpointHash) !== undefined;
}

/**
 * 자동 복구(표시 owner = 나 · 권한 granted) — 통로 확보(`requestPermission` 없이) →
 * `POST {…, source:'auto_resume', resume_marker_at}` → `decideResumeOutcome`. 표시 삭제는 여기서 적용한다.
 * 던지지 않는다(모든 실패는 outcome으로 돌려준다).
 */
export async function resumePushOnThisDevice(marker: PushResumeMarker): Promise<ResumeOutcome> {
  let attempt: ResumeAttemptResult;

  let subscription: PushSubscription | null = null;
  try {
    subscription = await subscribeExistingOrGranted();
  } catch {
    subscription = null;
  }

  const json = subscription?.toJSON();
  const p256dh = json?.keys?.p256dh;
  const auth = json?.keys?.auth;

  if (!json?.endpoint || !p256dh || !auth) {
    attempt = { kind: 'subscribe_failed' };
  } else {
    try {
      const { status } = await createPushSubscriptionWithStatus({
        endpoint: json.endpoint,
        keys: { p256dh, auth },
        userAgent: navigator.userAgent,
        source: 'auto_resume',
        resume_marker_at: resumeMarkerAtIso(marker)
      });
      attempt = { kind: 'http', status };
    } catch (error) {
      attempt = isPushApiError(error) ? { kind: 'http', status: error.status } : { kind: 'network_error' };
    }
  }

  const outcome = decideResumeOutcome(attempt);
  if (outcome.clearMarker) clearResumeMarker();
  return outcome;
}

/**
 * 표시 없음 · 통로가 내 기기 목록에 없음 — `POST …/subscriptions/detach` → `decideDetachOutcome`.
 * `detached`: 이전 주인 hash로 표시 기록 · `none`: 주인 없는 통로 해제 · `mine`: 변경 없음. 던지지 않는다.
 */
export async function detachPushChannelOnThisDevice(
  subscription: PushSubscription
): Promise<DetachOutcome> {
  let attempt: DetachAttemptResult;
  try {
    const data = await detachPushSubscription({ endpoint: subscription.endpoint });
    attempt = {
      kind: 'ok',
      result: data.result,
      previousOwnerHash: data.result === 'detached' ? data.previous_owner_hash : null
    };
  } catch (error) {
    attempt = isPushApiError(error) ? { kind: 'http_error', status: error.status } : { kind: 'network_error' };
  }

  const outcome = decideDetachOutcome(attempt);
  if (outcome.writeMarkerOwner) writeResumeMarker(outcome.writeMarkerOwner);
  if (outcome.unsubscribeChannel) {
    try {
      await subscription.unsubscribe();
    } catch {
      /* 브라우저 측 해제 실패 무시 — 서버 행이 없어 알림은 가지 않는다 */
    }
  }
  return outcome;
}

export function findThisDevice(
  devices: PushDevice[],
  endpointHash: string | null
): PushDevice | undefined {
  if (!endpointHash) return undefined;
  return devices.find((device) => device.endpoint_hash === endpointHash);
}

// ---------------------------------------------------------------------------
// Android `beforeinstallprompt` 캡처 (루트 layout에서 1회 시작)
// ---------------------------------------------------------------------------

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const INSTALL_PROMPT_CHANGE = 'wakeone:install-prompt-change';
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredInstallPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredInstallPrompt = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(INSTALL_PROMPT_CHANGE));
  }
}

export function subscribeInstallPrompt(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(INSTALL_PROMPT_CHANGE, onChange);
  return () => window.removeEventListener(INSTALL_PROMPT_CHANGE, onChange);
}

export function startInstallPromptCapture(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_PROMPT_CHANGE));
  };
  const handleInstalled = () => clearDeferredInstallPrompt();

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleInstalled);

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleInstalled);
  };
}

// ---------------------------------------------------------------------------
// iOS 배너 dismiss (localStorage · try/catch)
// ---------------------------------------------------------------------------

export function readIosBannerDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(IOS_INSTALL_BANNER_DISMISSED_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeIosBannerDismissedAt(timestamp = Date.now()) {
  try {
    window.localStorage.setItem(IOS_INSTALL_BANNER_DISMISSED_KEY, String(timestamp));
  } catch {
    /* 저장 불가(프라이빗 모드 등) — 세션 내에서만 숨김 */
  }
}

export function isIosBannerDismissActive(dismissedAt: number | null, now = Date.now()): boolean {
  if (dismissedAt == null) return false;
  return now - dismissedAt < IOS_INSTALL_BANNER_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}
