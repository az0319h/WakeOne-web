'use client';

import { createPushSubscription, deletePushSubscription } from '../api/push-service';
import type { PushDevice } from '../api/push-types';

/**
 * plan 91 — 브라우저 전용 푸시 유틸. 서버 모듈 import 금지.
 * 모든 판정은 mount 이후(useEffect)에 호출한다 — SSR에서는 `navigator`가 없다.
 */

export type PushDeviceStatus = 'loading' | 'unsupported' | 'not_configured' | 'denied' | 'off' | 'on';

export const IOS_INSTALL_BANNER_DISMISSED_KEY = 'wakeone.push.ios-banner-dismissed-at';
export const IOS_INSTALL_BANNER_DISMISS_DAYS = 7;

const UNSUBSCRIBE_TIMEOUT_MS = 2000;

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
    userAgent: navigator.userAgent
  });

  return { endpoint: json.endpoint, deviceCount: result.device_count };
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
 * Switch OFF · 로그아웃 — `DELETE {endpoint}` → `subscription.unsubscribe()`.
 * 2초 timeout · 모든 실패는 무시한다(로그아웃을 막지 않는다).
 */
export async function unsubscribePushOnThisDevice(): Promise<void> {
  if (!isPushSupported()) return;

  await withTimeout(
    (async () => {
      const subscription = await getCurrentPushSubscription();
      if (!subscription) return;

      try {
        await deletePushSubscription({ endpoint: subscription.endpoint });
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
    const result = await deletePushSubscription({ endpoint: subscription.endpoint });
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
