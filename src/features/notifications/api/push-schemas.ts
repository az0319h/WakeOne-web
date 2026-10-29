import { z } from 'zod';
import {
  PUSH_SUBSCRIPTION_CREATE_SOURCES,
  PUSH_SUBSCRIPTION_DELETE_SOURCES,
  isPushSubscriptionCreateSource,
  isPushSubscriptionDeleteSource,
  type PushSubscriptionCreateSource,
  type PushSubscriptionDeleteSource
} from '../lib/push-resume-decision';

/**
 * plan 91 · plan 105 — `/api/notifications/push/subscriptions/**` 요청 스키마.
 * Route가 쓰고, FE는 필요 시 같은 스키마로 미리 검증할 수 있다(서버 전용 import 없음).
 * 잘못된 입력은 모두 400 「구독 정보가 올바르지 않습니다.」(`PUSH_INVALID_SUBSCRIPTION_MESSAGE`).
 */

const base64Key = z
  .string()
  .trim()
  .min(8)
  .max(512)
  .regex(/^[A-Za-z0-9_\-+/]+=*$/, 'base64');

export const pushHttpsEndpointSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'https url');

/**
 * POST — 91 입력 + plan 105 `source`(기본 `manual`) · `resume_marker_at`(`auto_resume`이면 필수 · ISO datetime).
 * `manual`에 `resume_marker_at`이 와도 무시한다.
 */
export const createPushSubscriptionSchema = z
  .object({
    endpoint: pushHttpsEndpointSchema,
    keys: z.object({ p256dh: base64Key, auth: base64Key }),
    userAgent: z.string().trim().max(512).nullable().optional(),
    source: z.enum(PUSH_SUBSCRIPTION_CREATE_SOURCES).optional(),
    resume_marker_at: z.iso.datetime({ offset: true }).optional()
  })
  .superRefine((value, ctx) => {
    if (value.source === 'auto_resume' && !value.resume_marker_at) {
      ctx.addIssue({
        code: 'custom',
        path: ['resume_marker_at'],
        message: 'resume_marker_at required for auto_resume'
      });
    }
  });

/** DELETE — `{endpoint}` 또는 `{id}` + plan 105 `source`(기본 `manual`) */
export const deletePushSubscriptionSchema = z
  .object({
    endpoint: pushHttpsEndpointSchema.optional(),
    id: z.number().int().positive().optional(),
    source: z.enum(PUSH_SUBSCRIPTION_DELETE_SOURCES).optional()
  })
  .refine((value) => Boolean(value.endpoint) || typeof value.id === 'number', 'endpoint or id');

/** POST detach — `{endpoint}` (https · 2048자) */
export const detachPushSubscriptionSchema = z.object({
  endpoint: pushHttpsEndpointSchema
});

/**
 * 로그 metadata용 source — 검증 실패(400)에서도 남긴다.
 * 없음 → `manual`(기본값) · 허용 값 → 그 값 · 그 밖(`'nope'` 등) → undefined(남기지 않음).
 */
export function readCreateSourceForLog(body: unknown): PushSubscriptionCreateSource | undefined {
  const raw = body && typeof body === 'object' ? (body as { source?: unknown }).source : undefined;
  if (raw === undefined) return 'manual';
  return isPushSubscriptionCreateSource(raw) ? raw : undefined;
}

export function readDeleteSourceForLog(body: unknown): PushSubscriptionDeleteSource | undefined {
  const raw = body && typeof body === 'object' ? (body as { source?: unknown }).source : undefined;
  if (raw === undefined) return 'manual';
  return isPushSubscriptionDeleteSource(raw) ? raw : undefined;
}
