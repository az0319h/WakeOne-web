'use client';

import { useId, type KeyboardEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { QUICK_CHAT_BODY_MAX_LENGTH } from '../../schemas/quick-request-chat';
import { QUICK_CHAT_COUNTER_THRESHOLD, QUICK_CHAT_TEXT, quickChatText } from './quick-chat-constants';

type QuickChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (body: string) => void;
  isPending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onTypingInput: () => void;
  onTypingStop: () => void;
};

/**
 * 입력창 + 전송 (U-6 · AC-10·11). Enter 전송 · Shift+Enter 줄바꿈 · IME 조합 중 Enter 무시(`isComposing || keyCode 229`).
 * 900자부터 「남은 글자 N」, 1,000자 초과면 전송 비활성. 단일 필드라 TanStack Form 대신 controlled Textarea.
 */
export function QuickChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  isPending,
  textareaRef,
  onTypingInput,
  onTypingStop
}: QuickChatComposerProps) {
  const inputId = useId();
  const counterId = useId();
  const length = draft.length;
  const tooLong = length > QUICK_CHAT_BODY_MAX_LENGTH;
  const showCounter = length >= QUICK_CHAT_COUNTER_THRESHOLD;
  const canSubmit = draft.trim().length > 0 && !tooLong && !isPending;

  function submit() {
    if (!canSubmit) return;
    onTypingStop();
    onSubmit(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    submit();
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
        <label htmlFor={inputId} className='sr-only'>
          {QUICK_CHAT_TEXT.composerLabel}
        </label>
        <Textarea
          id={inputId}
          ref={textareaRef}
          rows={1}
          value={draft}
          placeholder={QUICK_CHAT_TEXT.composerPlaceholder}
          aria-describedby={showCounter ? counterId : undefined}
          aria-invalid={tooLong || undefined}
          enterKeyHint='send'
          autoComplete='off'
          data-testid='quick-chat-input'
          className='max-h-40 min-h-11 flex-1 resize-none text-base md:text-sm'
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
          className='h-11 shrink-0 px-4 md:h-10'
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
