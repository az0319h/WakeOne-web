'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { notifyError } from '@/lib/notify';
import { addWorkflowCommentMutation } from '../api/mutations';
import { WORKFLOW_COMMENT_MAX_LENGTH, WORKFLOW_MESSAGES } from '../lib/required-rules';

const COUNTER_THRESHOLD = 1900;

/** 댓글 입력 — 완료·반려·취소 문서에서도 쓸 수 있다 (designer §3.5) */
export function WorkflowCommentForm({ documentId }: { documentId: string }) {
  const [content, setContent] = useState('');
  const mutation = useMutation({ ...addWorkflowCommentMutation });
  const trimmed = content.trim();
  const tooLong = content.length > WORKFLOW_COMMENT_MAX_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && !mutation.isPending;

  function submit() {
    if (!canSubmit) return;
    mutation.mutate(
      { id: documentId, content: trimmed },
      {
        onSuccess: () => setContent(''),
        onError: (error) => notifyError(error.message)
      }
    );
  }

  return (
    <form
      className='flex flex-col gap-1'
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className='flex items-end gap-2'>
        <Textarea
          value={content}
          rows={1}
          aria-label='댓글'
          aria-invalid={tooLong || undefined}
          placeholder='댓글 입력…'
          data-testid='workflow-comment-input'
          className='max-h-40 min-h-10 resize-none border-transparent bg-muted/50 field-sizing-content'
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type='submit'
          size='sm'
          data-testid='workflow-comment-submit'
          className='h-10 shrink-0 px-4'
          disabled={!canSubmit}
          isLoading={mutation.isPending}
        >
          등록
        </Button>
      </div>
      {content.length >= COUNTER_THRESHOLD ? (
        <p className='text-right text-xs text-muted-foreground tabular-nums'>
          {content.length}/{WORKFLOW_COMMENT_MAX_LENGTH}
        </p>
      ) : null}
      {tooLong ? (
        <p role='alert' className='text-sm text-destructive'>
          {WORKFLOW_MESSAGES.commentTooLong}
        </p>
      ) : null}
    </form>
  );
}
