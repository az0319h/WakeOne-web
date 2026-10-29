'use client';

import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { scrollToFirstError, useAppForm } from '@/components/ui/tanstack-form';
import { ledgerFormFields } from '@/features/asset-ledger/components/asset-form-fields';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  createAssetRequestCommentMutation,
  updateAssetRequestCommentMutation
} from '../api/mutations';
import { ASSET_COMMENT_BODY_MAX } from '../api/types';
import { assetCommentFormSchema, type AssetCommentFormValues } from '../schemas/asset-request';

const { LedgerTextareaField: TypedTextarea } = ledgerFormFields<AssetCommentFormValues>();

type AssetCommentFormProps =
  | { mode: 'create'; requestId: number; onSuccess?: () => void }
  | {
      mode: 'reply';
      requestId: number;
      parentId: number;
      onCancel: () => void;
      onSuccess: () => void;
    }
  | {
      mode: 'edit';
      requestId: number;
      commentId: number;
      defaultBody: string;
      onCancel: () => void;
      onSuccess: () => void;
    };

/**
 * 댓글 입력 (support-comment-form 복제 · designer §2-6).
 * create = Dialog 하단 고정 입력(`asset-comment-input` · Ctrl/⌘+Enter) · reply/edit = 인라인(`asset-comment-inline-*`).
 * 제출 버튼은 미리 비활성화하지 않는다 — 빈 값이면 「댓글을 입력해 주세요.」. 성공 시에만 reset.
 */
export function AssetCommentForm(props: AssetCommentFormProps) {
  const { mode, requestId } = props;
  const isInline = mode !== 'create';

  const createMutation = useMutation({
    ...createAssetRequestCommentMutation,
    onSuccess: (response) => notifySuccess(response.message || '댓글을 등록했어요.'),
    onError: (error) =>
      notifyError(error instanceof Error ? error.message : '댓글을 등록하지 못했어요.')
  });
  const updateMutation = useMutation({
    ...updateAssetRequestCommentMutation,
    onSuccess: (response) => notifySuccess(response.message || '댓글을 수정했어요.'),
    onError: (error) =>
      notifyError(error instanceof Error ? error.message : '댓글을 수정하지 못했어요.')
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useAppForm({
    defaultValues: { body: mode === 'edit' ? props.defaultBody : '' } as AssetCommentFormValues,
    validators: { onSubmit: assetCommentFormSchema },
    onSubmitInvalid: () => scrollToFirstError(),
    onSubmit: async ({ value, formApi }) => {
      const payload = { body: value.body.trim() };
      try {
        if (props.mode === 'edit') {
          await updateMutation.mutateAsync({ requestId, commentId: props.commentId, payload });
          formApi.reset({ body: payload.body });
        } else {
          await createMutation.mutateAsync({
            requestId,
            parentId: props.mode === 'reply' ? props.parentId : null,
            payload
          });
          formApi.reset();
        }
        props.onSuccess?.();
      } catch {
        // 실패 — 토스트는 onError · 입력 유지
      }
    }
  });

  const submitLabel = mode === 'edit' ? '저장' : '등록';

  return (
    <form.AppForm>
      <form.Form
        className={isInline ? 'flex w-full flex-col gap-2' : 'flex w-full flex-row items-start gap-2'}
        aria-label={mode === 'edit' ? '댓글 수정' : mode === 'reply' ? '답글' : '댓글'}
      >
        <div className='min-w-0 flex-1'>
          <TypedTextarea
            name='body'
            label={mode === 'edit' ? '댓글 수정' : mode === 'reply' ? '답글' : '댓글'}
            hideLabel
            rows={isInline ? 2 : 1}
            maxLength={ASSET_COMMENT_BODY_MAX}
            autoFocus={isInline}
            placeholder={mode === 'edit' ? '수정할 댓글을 입력하세요' : '댓글을 입력하세요'}
            disabled={isPending}
            className={isInline ? 'min-h-16' : 'max-h-32 min-h-11 resize-none field-sizing-content'}
            data-testid={isInline ? 'asset-comment-inline-input' : 'asset-comment-input'}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void form.handleSubmit();
              }
            }}
          />
        </div>
        <div className={isInline ? 'flex justify-end gap-2' : 'flex shrink-0'}>
          {props.mode !== 'create' ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-9'
              disabled={isPending}
              onClick={props.onCancel}
            >
              취소
            </Button>
          ) : null}
          <Button
            type='submit'
            size={isInline ? 'sm' : 'default'}
            className={isInline ? 'h-9' : 'h-11 md:h-9'}
            data-testid={isInline ? 'asset-comment-inline-submit' : 'asset-comment-submit'}
            isLoading={isPending}
          >
            {isInline ? null : <Icons.send aria-hidden />}
            {submitLabel}
          </Button>
        </div>
      </form.Form>
    </form.AppForm>
  );
}
