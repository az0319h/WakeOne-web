import * as z from 'zod';

/**
 * plan 93 — 퀵 요청 건별 대화 공유 상수·스키마 (Route Handler · FE 공용).
 * 본문 1~1,000자(공백만 있으면 거부) · 작성자 역할 3종 · 빠른 답장 칩(역할별 고정 문구 · 채우기만).
 */

export const QUICK_CHAT_BODY_MAX_LENGTH = 1000;
/** 대화 1건당 불러오는 최근 메시지 수 (페이지네이션 Out · [INFERRED]) */
export const QUICK_CHAT_MESSAGES_LIMIT = 500;
/** 대화 목록 최대 건수 */
export const QUICK_CHAT_CONVERSATIONS_LIMIT = 100;
/** 대화 목록 미리보기 본문 길이 */
export const QUICK_CHAT_PREVIEW_LENGTH = 120;

export const QUICK_CHAT_AUTHOR_ROLES = ['requester', 'dongbang', 'admin'] as const;
export type QuickChatAuthorRole = (typeof QUICK_CHAT_AUTHOR_ROLES)[number];

/** 대화를 보는 사람의 역할 (`logistics` = 구매물류팀 읽기 전용) */
export type QuickChatViewerRole = QuickChatAuthorRole | 'logistics';

export type QuickChatReadOnlyReason = 'logistics' | 'locked';

/** 서버 응답 문구 (FE는 `message`를 그대로 `notifyError`) */
export const QUICK_CHAT_MESSAGES = {
  bodyRequired: '메시지를 입력해 주세요.',
  bodyTooLong: '메시지는 1,000자까지 입력할 수 있습니다.',
  invalidBody: '요청 형식이 올바르지 않습니다.',
  logisticsReadOnly: '구매물류팀은 대화를 볼 수만 있습니다.',
  locked: '승인되었거나 취소된 요청은 대화를 보낼 수 없습니다.',
  notFound: '퀵 요청을 찾을 수 없습니다.',
  messageNotFound: '메시지를 찾을 수 없습니다.',
  sendFailed: '메시지를 보내지 못했습니다. 다시 시도해 주세요.',
  internalError: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
} as const;

/** 읽기 전용 안내 문구 (U-7) */
export const QUICK_CHAT_READ_ONLY_NOTICE: Record<QuickChatReadOnlyReason, string> = {
  logistics: QUICK_CHAT_MESSAGES.logisticsReadOnly,
  locked: QUICK_CHAT_MESSAGES.locked
};

/** 역할 라벨 (말풍선 배지) */
export const QUICK_CHAT_ROLE_LABELS: Record<QuickChatAuthorRole, string> = {
  requester: '요청자',
  dongbang: '동방특송',
  admin: '관리자'
};

/** 빠른 답장 칩 (C-14 · 입력창에 채우기만) — 요청자 3 · 동방특송/admin 4 · 읽기 전용 0 */
export const QUICK_CHAT_QUICK_REPLIES: Record<QuickChatViewerRole, readonly string[]> = {
  requester: ['취소 부탁드립니다', '시간 변경 부탁드립니다', '연락 부탁드립니다'],
  dongbang: ['확인했습니다', '처리했습니다', '불가능합니다', '잠시만 기다려 주세요'],
  admin: ['확인했습니다', '처리했습니다', '불가능합니다', '잠시만 기다려 주세요'],
  logistics: []
};

export const quickChatBodySchema = z
  .string({ error: QUICK_CHAT_MESSAGES.invalidBody })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, QUICK_CHAT_MESSAGES.bodyRequired)
      .max(QUICK_CHAT_BODY_MAX_LENGTH, QUICK_CHAT_MESSAGES.bodyTooLong)
  );

/** POST …/messages */
export const quickChatMessageBodySchema = z.object({
  body: quickChatBodySchema
});

export type QuickChatMessageBody = z.infer<typeof quickChatMessageBodySchema>;

/** PUT …/messages/read — 0은 「읽음 위치 없음」과 같다(greatest로 유지) */
export const quickChatMarkReadBodySchema = z.object({
  lastMessageId: z.number({ error: QUICK_CHAT_MESSAGES.invalidBody }).int().nonnegative()
});

export type QuickChatMarkReadBody = z.infer<typeof quickChatMarkReadBodySchema>;

export const QUICK_CHAT_CONVERSATION_TABS = ['all', 'unread'] as const;
export type QuickChatConversationTab = (typeof QUICK_CHAT_CONVERSATION_TABS)[number];

export function isQuickChatConversationTab(value: string | null | undefined): value is QuickChatConversationTab {
  return Boolean(value && (QUICK_CHAT_CONVERSATION_TABS as readonly string[]).includes(value));
}
