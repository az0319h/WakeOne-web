'use client';

import {
  decideForcedSignOutOutcome,
  isResumeLockActive,
  parseResumeMarker,
  PUSH_DEVICE_CHANGED_EVENT,
  PUSH_RESUME_LOCK_STORAGE_KEY,
  PUSH_RESUME_OWNER_STORAGE_KEY,
  pushOwnerHashInput,
  serializeResumeMarker,
  truncatePushOwnerHash,
  type PushResumeMarker
} from './push-resume-decision';

/**
 * plan 105 — 기기 표시(`localStorage`) · owner hash(Web Crypto) · 다중 탭 잠금 · 기기 변경 이벤트.
 * 브라우저 전용 leaf 모듈 — `push-client.ts`가 이 파일을 import한다(반대 방향 import 금지 · 순환 방지).
 * 저장소 접근은 전부 try/catch — 저장할 수 없는 환경(프라이빗 모드 등)이면 자동 복구 없이 기존 동작으로 떨어진다.
 */

export function readResumeMarker(): PushResumeMarker | null {
  try {
    return parseResumeMarker(window.localStorage.getItem(PUSH_RESUME_OWNER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeResumeMarker(owner: string, at: number = Date.now()) {
  try {
    window.localStorage.setItem(PUSH_RESUME_OWNER_STORAGE_KEY, serializeResumeMarker({ owner, at }));
  } catch {
    /* 저장 불가 — 자동 복구 없이 직접 켜기로 떨어진다 */
  }
}

export function clearResumeMarker() {
  try {
    window.localStorage.removeItem(PUSH_RESUME_OWNER_STORAGE_KEY);
  } catch {
    /* 저장 불가 — 무시 */
  }
}

/** 강제 로그아웃 — 표시 owner가 「나」일 때만 삭제한다(hash를 모르면 그대로 · 서버 409가 이중으로 막는다) */
export function clearOwnResumeMarker(myOwnerHash: string | null) {
  if (!myOwnerHash) return;
  const outcome = decideForcedSignOutOutcome(readResumeMarker(), myOwnerHash);
  if (outcome.clearOwnMarker) clearResumeMarker();
}

/** `sha256('wakeone-push-owner:' + userId)` hex 앞 16자 — 서버 `hashPushOwner`와 같은 값. 실패하면 null */
export async function hashPushOwner(userId: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(pushOwnerHashInput(userId));
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return truncatePushOwnerHash(hex);
  } catch {
    return null;
  }
}

/**
 * 여러 탭이 동시에 대시보드에 들어와도 POST·토스트를 1회만 하도록 15초 잠금을 잡는다.
 * 다른 탭이 잠금 중이면 false. 저장소를 쓸 수 없으면 true(조율 없이 진행 — POST는 멱등).
 */
export function tryAcquireResumeLock(now: number = Date.now()): boolean {
  try {
    const storage = window.localStorage;
    if (isResumeLockActive(storage.getItem(PUSH_RESUME_LOCK_STORAGE_KEY), now)) return false;
    storage.setItem(PUSH_RESUME_LOCK_STORAGE_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

export function releaseResumeLock() {
  try {
    window.localStorage.removeItem(PUSH_RESUME_LOCK_STORAGE_KEY);
  } catch {
    /* 저장 불가 — 무시 */
  }
}

/** 프로필 `usePushDeviceStatus`·`PushResumeSync`가 이 기기 상태를 다시 읽도록 알린다 */
export function notifyPushDeviceChanged() {
  try {
    window.dispatchEvent(new Event(PUSH_DEVICE_CHANGED_EVENT));
  } catch {
    /* SSR 등 — 무시 */
  }
}

export function subscribePushDeviceChanged(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PUSH_DEVICE_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(PUSH_DEVICE_CHANGED_EVENT, onChange);
}

/** 다른 탭에서 기기 표시가 지워지면(자동 복구 성공·닫기) 알린다 */
export function subscribeResumeMarkerRemoved(onRemoved: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PUSH_RESUME_OWNER_STORAGE_KEY && event.newValue === null) onRemoved();
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}
