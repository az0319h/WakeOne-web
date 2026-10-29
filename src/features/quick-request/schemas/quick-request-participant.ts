import * as z from 'zod';

/**
 * plan 101 — 퀵 대화 초대 참여자 공유 상수·스키마 (Route Handler · FE 공용).
 * 초대 권한(D-1): 요청자·admin. 후보(D-2 r1): active · 동방 제외 · admin 제외 · 요청자·본인·활성 참여자 제외.
 */

/** 후보 검색어 최대 길이 · 결과 상한 (D-2) */
export const QUICK_CHAT_CANDIDATE_QUERY_MAX_LENGTH = 50;
export const QUICK_CHAT_CANDIDATE_LIMIT = 20;

/** 서버 응답 문구 (FE는 `message`를 그대로 `notifyError`) */
export const QUICK_CHAT_PARTICIPANT_MESSAGES = {
  /** 403 — 동방·구매물류·참여자가 초대/후보 조회 (D-1) */
  forbidden: '참여자를 추가할 권한이 없습니다.',
  /** 403 — 제외 권한 없음 (초대자·admin·본인 외) */
  removeForbidden: '참여자를 제외할 권한이 없습니다.',
  /** 400 — 후보 아님 (admin·동방·pending·요청자·본인 · D-2) */
  notInvitable: '초대할 수 없는 사용자입니다.',
  /** 409 — 활성 참여 중 */
  alreadyParticipant: '이미 참여 중입니다.',
  /** 404 — 사용자 없음 */
  userNotFound: '사용자를 찾을 수 없습니다.',
  /** 404 — 활성 참여자가 아님 (제외·나가기) */
  notParticipant: '참여 중인 사용자가 아닙니다.',
  invalidBody: '요청 형식이 올바르지 않습니다.',
  inviteFailed: '참여자를 추가하지 못했습니다. 다시 시도해 주세요.',
  removeFailed: '참여자를 제외하지 못했습니다. 다시 시도해 주세요.'
} as const;

/** POST …/participants `{ userId }` — 형식(uuid)은 Route가 `parseQuickChatParticipantUserId`로 검사해 404(사용자 없음 · AC-07 `zzz`) */
export const quickChatInviteBodySchema = z.object({
  userId: z
    .string({ error: QUICK_CHAT_PARTICIPANT_MESSAGES.invalidBody })
    .trim()
    .min(1, QUICK_CHAT_PARTICIPANT_MESSAGES.invalidBody)
    .max(100, QUICK_CHAT_PARTICIPANT_MESSAGES.invalidBody)
});

export type QuickChatInviteBody = z.infer<typeof quickChatInviteBodySchema>;

/** `[userId]` path segment → uuid (아니면 null → 404) */
export function parseQuickChatParticipantUserId(raw: string): string | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return z.string().uuid().safeParse(value).success ? value.toLowerCase() : null;
}

/** 참여자 이벤트 종류 (D-7 · `left` = `removed_by === user_id`) */
export const QUICK_CHAT_PARTICIPANT_EVENT_TYPES = ['joined', 'removed', 'left'] as const;
export type QuickChatParticipantEventType = (typeof QUICK_CHAT_PARTICIPANT_EVENT_TYPES)[number];
