'use client';

import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  createSupportCommentMutation,
  createSupportCommentReplyMutation,
  updateSupportCommentMutation
} from '../api/mutations';
import {
  emptySupportCommentFormValues,
  supportCommentFormSchema,
  type SupportCommentFormValues
} from '../schemas/support-form';

type SupportCommentFormMode = 'create' | 'reply' | 'edit';

interface SupportCommentFormProps {
  supportRequestId: number;
  mode: SupportCommentFormMode;
  commentId?: number;
  defaultBody?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
}

function getDefaultValues(defaultBody?: string): SupportCommentFormValues {
  return {
    body: defaultBody ?? ''
  };
}

export function SupportCommentForm({
  supportRequestId,
  mode,
  commentId,
  defaultBody,
  autoFocus = false,
  onCancel,
  onSuccess
}: SupportCommentFormProps) {
  const { FormTextareaField } = useFormFields<SupportCommentFormValues>();
  const createMutation = useMutation({
    ...createSupportCommentMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '댓글이 등록되었습니다.');
      form.reset(emptySupportCommentFormValues);
      onSuccess?.();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '댓글 등록에 실패했습니다.');
    }
  });
  const replyMutation = useMutation({
    ...createSupportCommentReplyMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '답글이 등록되었습니다.');
      form.reset(emptySupportCommentFormValues);
      onSuccess?.();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '답글 등록에 실패했습니다.');
    }
  });
  const updateMutation = useMutation({
    ...updateSupportCommentMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '댓글이 수정되었습니다.');
      form.reset(getDefaultValues(defaultBody));
      onSuccess?.();
    },
    onError: (error) => {
      notifyError(error instanceof Error ? error.message : '댓글 수정에 실패했습니다.');
    }
  });

  const isPending =
    createMutation.isPending || replyMutation.isPending || updateMutation.isPending;

  const form = useAppForm({
    defaultValues: getDefaultValues(defaultBody),
    validators: {
      onSubmit: supportCommentFormSchema
    },
    onSubmit: async ({ value }) => {
      const payload = { body: value.body.trim() };

      if (mode === 'create') {
        await createMutation.mutateAsync({ supportRequestId, payload });
        return;
      }

      if (!commentId) {
        notifyError('댓글 ID가 올바르지 않습니다.');
        return;
      }

      if (mode === 'reply') {
        await replyMutation.mutateAsync({ supportRequestId, commentId, payload });
        return;
      }

      await updateMutation.mutateAsync({ supportRequestId, commentId, payload });
    }
  });

  return (
    <form.AppForm>
      <form.Form className='flex flex-col gap-2 p-0 md:p-0'>
        <FormTextareaField
          name='body'
          label={mode === 'edit' ? '댓글 수정' : mode === 'reply' ? '답글' : '댓글'}
          rows={mode === 'create' ? 3 : 2}
          required
          placeholder={
            mode === 'edit' ? '수정할 댓글을 입력하세요.' : '댓글을 입력하세요.'
          }
          autoFocus={autoFocus}
          disabled={isPending}
        />
        <div className='flex justify-end gap-2'>
          {onCancel ? (
            <Button type='button' variant='outline' size='sm' disabled={isPending} onClick={onCancel}>
              취소
            </Button>
          ) : null}
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              body: state.values.body
            })}
          >
            {({ canSubmit, body }) => (
              <Button
                type='submit'
                size='sm'
                isLoading={isPending}
                disabled={!canSubmit || body.trim().length === 0}
              >
                {mode === 'edit' ? '저장' : '등록'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form.Form>
    </form.AppForm>
  );
}
