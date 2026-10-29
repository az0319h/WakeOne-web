import type { PushGroupCatalogItem, PushGroupKey } from '../lib/push-groups';
import type {
  PushSubscriptionCreateSource,
  PushSubscriptionDeleteSource
} from '../lib/push-resume-decision';

/**
 * plan 91 — `/api/notifications/push/**` 요청·응답 계약 (FE `push-service.ts`·`push-queries.ts`·`push-mutations.ts`가 사용).
 * 모든 응답은 `{ success: true, data }` 또는 `{ success: false, message }`.
 */

export type PushDevice = {
  id: number;
  user_agent: string | null;
  created_at: string;
  /** 마지막 발송 성공 시각 · 없으면 null */
  last_used_at: string | null;
  /** sha256(endpoint) hex 앞 16자 — endpoint 원문은 응답에 없다 */
  endpoint_hash: string;
};

/** GET /api/notifications/push/preferences */
export type PushPreferencesResponse = {
  /** VAPID 3종 설정 여부. false면 토글 비활성·발송 스킵 */
  configured: boolean;
  disabled_groups: PushGroupKey[];
  device_count: number;
  devices: PushDevice[];
  /** 역할 필터 적용 — user 8 · admin 9 */
  groups: PushGroupCatalogItem[];
};

/** PUT /api/notifications/push/preferences */
export type UpdatePushPreferencesPayload = {
  disabled_groups: PushGroupKey[];
};
export type UpdatePushPreferencesResponse = {
  disabled_groups: PushGroupKey[];
};

/** POST /api/notifications/push/subscriptions — `PushSubscription.toJSON()` 형태 + userAgent */
export type CreatePushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
  /** plan 105 — 기본 `manual`(스위치·「다시 켜기」) · `auto_resume`(재로그인 자동 복구) */
  source?: PushSubscriptionCreateSource;
  /** plan 105 — `auto_resume`이면 **필수** · 기기 표시 시각 ISO(`resumeMarkerAtIso(marker)`) */
  resume_marker_at?: string;
};
/**
 * 201 신규 · 200 기존(멱등).
 * plan 105 `auto_resume` 409 2종(다른 계정 소유 · 표시 이후 비활성화 이력) — `PushApiError.status`로 구분.
 */
export type CreatePushSubscriptionResponse = {
  id: number;
  device_count: number;
};

/**
 * DELETE /api/notifications/push/subscriptions — endpoint 또는 id 중 하나.
 * plan 105 `source`: 기본 `manual` · 로그아웃 버튼 `sign_out` · 강제 로그아웃 `forced_sign_out`.
 */
export type DeletePushSubscriptionPayload = ({ endpoint: string } | { id: number }) & {
  source?: PushSubscriptionDeleteSource;
};
export type DeletePushSubscriptionResponse = {
  device_count: number;
};

/** plan 105 — POST /api/notifications/push/subscriptions/detach */
export type DetachPushSubscriptionPayload = { endpoint: string };
/** 200 — `detached`면 이전 주인 owner hash(16자 hex · 기기 표시에 기록) */
export type DetachPushSubscriptionResponse =
  | { result: 'detached'; previous_owner_hash: string }
  | { result: 'none' }
  | { result: 'mine' };

/** POST /api/notifications/push/test — 200 · 409(기기 없음) · 503(미설정) */
export type PushTestSendResponse = {
  attempted: number;
  sent: number;
  removed: number;
};

/** sw.js가 받는 push payload (push-sender `PushPayload`와 동일) */
export type PushMessagePayload = {
  notificationId: number | null;
  title: string;
  body: string;
  url: string;
  tag: string;
  unreadCount: number | null;
};
