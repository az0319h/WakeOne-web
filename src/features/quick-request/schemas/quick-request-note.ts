import * as z from 'zod';

/** plan 87 — 특이사항 칩 라벨 (trim 후 1~30자) · 사용자별 최대 10개 */
export const QUICK_REQUEST_NOTE_LABEL_MAX_LENGTH = 30;
export const QUICK_REQUEST_NOTES_MAX_COUNT = 10;
export const QUICK_REQUEST_NOTE_SEED_LABEL = '동승 필요';

export const QUICK_REQUEST_NOTE_MESSAGES = {
  labelRequired: '특이사항을 입력해 주세요.',
  labelTooLong: '30자 이내로 입력해 주세요.',
  duplicate: '이미 등록된 특이사항입니다.',
  limitExceeded: '특이사항은 최대 10개까지 등록할 수 있습니다.',
  notFound: '특이사항을 찾을 수 없습니다.',
  internalError: '처리 중 오류가 발생했습니다.',
  invalidBody: '요청 형식이 올바르지 않습니다.'
} as const;

export const quickRequestNoteLabelSchema = z
  .string({ error: QUICK_REQUEST_NOTE_MESSAGES.labelRequired })
  .trim()
  .min(1, QUICK_REQUEST_NOTE_MESSAGES.labelRequired)
  .max(QUICK_REQUEST_NOTE_LABEL_MAX_LENGTH, QUICK_REQUEST_NOTE_MESSAGES.labelTooLong);

export const quickRequestNoteBodySchema = z.object({
  label: quickRequestNoteLabelSchema
});

export type QuickRequestNoteBody = z.infer<typeof quickRequestNoteBodySchema>;
