'use client';

import { useId, useRef, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { QuickChatAttachmentItem } from '../../lib/quick-chat-cache';
import { QUICK_CHAT_ATTACHMENT_ACCEPT } from '../../schemas/quick-request-attachment';
import { QUICK_CHAT_BODY_MAX_LENGTH } from '../../schemas/quick-request-chat';
import { QUICK_CHAT_COUNTER_THRESHOLD, QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';
import type { UseAttachmentUploadResult } from './use-attachment-upload';
import { useMatchMedia } from './use-match-media';

/** plan 106 D-13 ① — 터치 기기 판정 (화면 폭이 아니라 입력 장치 · 마우스 PC는 Enter 전송 유지) */
const COARSE_POINTER_MEDIA_QUERY = '(pointer: coarse)';

type QuickChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  /** 본문(공백 허용 · 첨부 ≥1) + 업로드 완료 첨부 스냅샷 */
  onSubmit: (body: string, attachments: QuickChatAttachmentItem[]) => void;
  isPending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onTypingInput: () => void;
  onTypingStop: () => void;
  /** plan 98 — 첨부 대기 줄 상태 (전송 활성 규칙 §3-2) */
  attachments: UseAttachmentUploadResult;
};

/**
 * 입력창 + 전송 (U-6 · AC-10·11). Enter 전송 · Shift+Enter 줄바꿈 · IME 조합 중 Enter 무시(`isComposing || keyCode 229`).
 * 900자부터 「남은 글자 N」, 1,000자 초과면 전송 비활성. 단일 필드라 TanStack Form 대신 controlled Textarea.
 * plan 98 U-1 — 왼쪽 클립 버튼(숨은 `<input type=file multiple>`) · 전송은 본문 또는 완료 첨부 ≥1 · 업로드 중·실패 칩이면 비활성.
 * mobile-ux 2차 #3 — placeholder는 짧게(빈 입력창 1줄 44px · `field-sizing-content`), Enter·Shift+Enter 안내는 sr-only 설명.
 * plan 106 D-13 — 터치 기기(`pointer: coarse`)는 Enter = 줄바꿈(`enterKeyHint='enter'` · 보내기는 「전송」 버튼만 · 안내문도 바꿈).
 * 글자 16px는 lg 미만 전부(ui `Textarea` 기본 `md:text-sm`을 `md:text-base`로 덮어 T768도 확대 없음) · lg↑ 14px 그대로.
 */
export function QuickChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  isPending,
  textareaRef,
  onTypingInput,
  onTypingStop,
  attachments
}: QuickChatComposerProps) {
  const inputId = useId();
  const hintId = useId();
  const counterId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCoarsePointer = useMatchMedia(COARSE_POINTER_MEDIA_QUERY);
  const length = draft.length;
  const tooLong = length > QUICK_CHAT_BODY_MAX_LENGTH;
  const showCounter = length >= QUICK_CHAT_COUNTER_THRESHOLD;
  const hasContent = draft.trim().length > 0 || attachments.uploadedCount > 0;
  const canSubmit = hasContent && !tooLong && !isPending && !attachments.isUploading && !attachments.hasFailed;

  function submit() {
    if (!canSubmit) return;
    onTypingStop();
    const snapshot = attachments.snapshot();
    onSubmit(draft, snapshot);
    attachments.clear();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // 터치 기기는 Enter 기본 동작(줄바꿈) 그대로 — 전송은 버튼만 (plan 106 D-13 ①)
    if (isCoarsePointer) return;
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    attachments.add(files);
    // 같은 파일을 다시 고를 수 있게 비운다
    event.target.value = '';
  }

  return (
    <form
      className='flex flex-col gap-1'
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submit();
      }}
    >
      <div className='flex items-end gap-2'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-11 shrink-0 touch-manipulation lg:size-10'
          aria-label={QUICK_CHAT_TEXT.attach}
          data-testid='quick-chat-attach'
          disabled={isPending || attachments.items.length >= attachments.max}
          onClick={() => fileInputRef.current?.click()}
        >
          <Icons.paperclip aria-hidden className='size-5' />
        </Button>
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={QUICK_CHAT_ATTACHMENT_ACCEPT}
          className='sr-only'
          tabIndex={-1}
          aria-hidden
          data-testid='quick-chat-attach-input'
          onChange={handleFilesChange}
        />
        <label htmlFor={inputId} className='sr-only'>
          {QUICK_CHAT_TEXT.composerLabel}
        </label>
        <p id={hintId} className='sr-only'>
          {isCoarsePointer ? QUICK_CHAT_TEXT.composerHintTouch : QUICK_CHAT_TEXT.composerHint}
        </p>
        <Textarea
          id={inputId}
          ref={textareaRef}
          rows={1}
          value={draft}
          placeholder={QUICK_CHAT_TEXT.composerPlaceholder}
          aria-describedby={showCounter ? `${hintId} ${counterId}` : hintId}
          aria-invalid={tooLong || undefined}
          enterKeyHint={isCoarsePointer ? 'enter' : 'send'}
          autoComplete='off'
          data-testid='quick-chat-input'
          className='max-h-40 min-h-11 flex-1 resize-none text-base md:text-base lg:text-sm'
          onChange={(event) => {
            onDraftChange(event.target.value);
            if (event.target.value.length > 0) {
              onTypingInput();
            }
          }}
          onBlur={onTypingStop}
          onKeyDown={handleKeyDown}
        />
        <Button
          type='submit'
          className='h-11 shrink-0 px-4 lg:h-10'
          aria-label={QUICK_CHAT_TEXT.send}
          data-testid='quick-chat-send'
          isLoading={isPending}
          disabled={!canSubmit}
        >
          <Icons.send aria-hidden />
          {QUICK_CHAT_TEXT.send}
        </Button>
      </div>
      {showCounter ? (
        <p
          id={counterId}
          aria-live='polite'
          data-testid='quick-chat-counter'
          className={cn('text-xs tabular-nums', tooLong ? 'text-destructive' : 'text-muted-foreground')}
        >
          {tooLong ? QUICK_CHAT_TEXT.tooLong : quickChatText.remaining(QUICK_CHAT_BODY_MAX_LENGTH - length)}
        </p>
      ) : null}
    </form>
  );
}
