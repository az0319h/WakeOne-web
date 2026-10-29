import * as z from 'zod';
import {
  QUICK_CHAT_ATTACHMENT_MESSAGES,
  quickChatAttachmentIdsSchema
} from './quick-request-attachment';

/**
 * plan 93 — 퀵 요청 건별 대화 공유 상수·스키마 (Route Handler · FE 공용).
 * 본문 ≤ 1,000자 · 작성자 역할 3종 · 빠른 답장 칩(역할별 고정 문구 · 채우기만).
 * plan 98 — 본문은 첨부가 1개 이상이면 비울 수 있다(`attachmentIds`). 「본문도 첨부도 없음」은 Route·RPC가 거부한다.
 */

export const QUICK_CHAT_BODY_MAX_LENGTH = 1000;
/** 대화 1건당 불러오는 최근 메시지 수 (페이지네이션 Out · [INFERRED]) */
export const QUICK_CHAT_MESSAGES_LIMIT = 500;
/** plan 97 D-5 — 대화 목록 커서 페이지 크기 (기본 20 · 최대 50) */
export const QUICK_CHAT_CONVERSATIONS_PAGE_SIZE = 20;
export const QUICK_CHAT_CONVERSATIONS_MAX_LIMIT = 50;
/** 대화 목록 미리보기 본문 길이 */
export const QUICK_CHAT_PREVIEW_LENGTH = 120;

/** plan 101 — `participant` = 초대된 직원 (D-5) */
export const QUICK_CHAT_AUTHOR_ROLES = ['requester', 'dongbang', 'admin', 'participant'] as const;
export type QuickChatAuthorRole = (typeof QUICK_CHAT_AUTHOR_ROLES)[number];

/** 대화를 보는 사람의 역할 (`logistics` = 구매물류팀 읽기 전용) */
export type QuickChatViewerRole = QuickChatAuthorRole | 'logistics';

/** plan 94 D-12 — 승인·취소 건도 대화 가능. 읽기 전용 사유는 구매물류팀뿐 */
export type QuickChatReadOnlyReason = 'logistics';

/** 서버 응답 문구 (FE는 `message`를 그대로 `notifyError`) */
export const QUICK_CHAT_MESSAGES = {
  /** plan 98 — 본문·첨부 둘 다 없음 (93 AC-08 문구 교체) */
  bodyRequired: QUICK_CHAT_ATTACHMENT_MESSAGES.bodyOrAttachmentRequired,
  bodyTooLong: '메시지는 1,000자까지 입력할 수 있습니다.',
  invalidBody: '요청 형식이 올바르지 않습니다.',
  logisticsReadOnly: '구매물류팀은 대화를 볼 수만 있습니다.',
  notFound: '퀵 요청을 찾을 수 없습니다.',
  messageNotFound: '메시지를 찾을 수 없습니다.',
  sendFailed: '메시지를 보내지 못했습니다. 다시 시도해 주세요.',
  internalError: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
} as const;

/** 읽기 전용 안내 문구 (U-7) */
export const QUICK_CHAT_READ_ONLY_NOTICE: Record<QuickChatReadOnlyReason, string> = {
  logistics: QUICK_CHAT_MESSAGES.logisticsReadOnly
};

/** 역할 라벨 (말풍선 배지) */
export const QUICK_CHAT_ROLE_LABELS: Record<QuickChatAuthorRole, string> = {
  requester: '요청자',
  dongbang: '동방특송',
  admin: '관리자',
  participant: '참여자'
};

/** 빠른 답장 칩 (C-14 · 입력창에 채우기만) — 요청자 3 · 동방특송/admin 4 · 참여자 4(plan 101 D-5) · 읽기 전용 0 */
export const QUICK_CHAT_QUICK_REPLIES: Record<QuickChatViewerRole, readonly string[]> = {
  requester: ['취소 부탁드립니다', '시간 변경 부탁드립니다', '연락 부탁드립니다'],
  dongbang: ['확인했습니다', '처리했습니다', '불가능합니다', '잠시만 기다려 주세요'],
  admin: ['확인했습니다', '처리했습니다', '불가능합니다', '잠시만 기다려 주세요'],
  participant: ['확인했습니다', '연락 부탁드립니다', '감사합니다', '잠시만 기다려 주세요'],
  logistics: []
};

/** 본문 — 앞뒤 공백 제거 · ≤ 1,000자. 빈 값 허용(첨부 유무는 `quickChatMessageBodySchema` 다음 단계에서 검사) */
export const quickChatBodySchema = z
  .string({ error: QUICK_CHAT_MESSAGES.invalidBody })
  .transform((value) => value.trim())
  .pipe(z.string().max(QUICK_CHAT_BODY_MAX_LENGTH, QUICK_CHAT_MESSAGES.bodyTooLong));

/** POST …/messages — `body` 생략은 `''`와 같다 · `attachmentIds` 생략은 `[]` (plan 98) */
export const quickChatMessageBodySchema = z.object({
  body: quickChatBodySchema.optional().default(''),
  attachmentIds: quickChatAttachmentIdsSchema.optional().default([])
});

/** 본문도 첨부도 없는 전송 → `bodyRequired`(「메시지를 입력하거나 파일을 첨부해 주세요.」) */
export function isQuickChatMessageEmpty(input: { body: string; attachmentIds: readonly number[] }): boolean {
  return input.body.trim().length === 0 && input.attachmentIds.length === 0;
}

export type QuickChatMessageBody = z.infer<typeof quickChatMessageBodySchema>;

/** PUT …/messages/read — 0은 「읽음 위치 없음」과 같다(greatest로 유지) */
export const quickChatMarkReadBodySchema = z.object({
  lastMessageId: z.number({ error: QUICK_CHAT_MESSAGES.invalidBody }).int().nonnegative()
});

export type QuickChatMarkReadBody = z.infer<typeof quickChatMarkReadBodySchema>;

// ---------------------------------------------------------------------------
// plan 100 — AI 답장 추천 (Claude Haiku · 칩 4개 · 규칙 칩 fallback · 채우기만)
// ---------------------------------------------------------------------------

/** 추천은 항상 4개 (AI 부족분은 규칙 칩으로 채움 · D-3) */
export const QUICK_CHAT_AI_SUGGESTION_COUNT = 4;
/** 추천 문장 1개 최대 길이 (서버 후처리 클립 · D-3) */
export const QUICK_CHAT_AI_SUGGESTION_MAX_LENGTH = 40;
/** 사용자당 KST 하루 호출 상한 (admin 포함 · D-6) */
export const QUICK_CHAT_AI_DAILY_LIMIT = 100;
/** 모델에 보내는 최근 메시지 수 · 메시지당 본문 클립 길이 (D-4) */
export const QUICK_CHAT_AI_CONTEXT_MESSAGES = 10;
export const QUICK_CHAT_AI_BODY_CLIP_LENGTH = 300;

/**
 * 규칙 칩이 4개 미만인 역할(요청자 3개)의 남는 칸을 채우는 공통 문구 (designer §9-1).
 * 순서대로 쓰고, 이미 있는 문장과 겹치면 건너뛴다.
 */
export const QUICK_CHAT_AI_EXTRA_REPLIES: readonly string[] = [
  '잠시만 기다려 주세요',
  '확인했습니다',
  '감사합니다',
  '연락 부탁드립니다'
];

/** POST …/messages/suggest 응답 문구 (FE는 화면에 띄우지 않음 · 로그·테스트용) */
export const QUICK_CHAT_AI_MESSAGES = {
  disabled: '답장 추천이 꺼져 있습니다.',
  noNewMessage: '추천할 새 메시지가 없습니다.',
  limit: '오늘 답장 추천 횟수를 모두 사용했습니다.',
  failed: '답장 추천을 불러오지 못했습니다.'
} as const;

/** 추천 출처 — AI 문장이 1개 이상이면 `ai`, 0개(전부 필터·refusal·파싱 실패)면 `rules` */
export const QUICK_CHAT_AI_SOURCES = ['ai', 'rules'] as const;
export type QuickChatAiSource = (typeof QUICK_CHAT_AI_SOURCES)[number];

/** 오류 응답 `reason` — 409 stale · 429 limit · 502 failed · 503 disabled */
export type QuickChatAiErrorReason = 'stale' | 'limit' | 'failed' | 'disabled';

/** POST …/messages/suggest `{ lastMessageId }` — 그 건의 현재 마지막 메시지(남이 보낸 것) id */
export const quickChatAiSuggestBodySchema = z.object({
  lastMessageId: z.number({ error: QUICK_CHAT_MESSAGES.invalidBody }).int().positive()
});

export type QuickChatAiSuggestBody = z.infer<typeof quickChatAiSuggestBodySchema>;

export const QUICK_CHAT_CONVERSATION_TABS = ['all', 'unread'] as const;
export type QuickChatConversationTab = (typeof QUICK_CHAT_CONVERSATION_TABS)[number];

export function isQuickChatConversationTab(value: string | null | undefined): value is QuickChatConversationTab {
  return Boolean(value && (QUICK_CHAT_CONVERSATION_TABS as readonly string[]).includes(value));
}
