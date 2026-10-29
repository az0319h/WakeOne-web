'use client';

import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { notifyError, notifySuccess } from '@/lib/notify';
import { changeAssetRequestStatusMutation } from '../api/mutations';
import { ASSET_REJECT_REASON_MAX } from '../api/types';
import { assetRejectFormSchema } from '../schemas/asset-request';

type AssetRequestRejectModalProps = {
  requestId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * 반려 (plan D-14 · AC-30) — AlertModal + 사유 Textarea(필수 · 요청자에게 보임).
 * 빈 사유로 「반려」 → 「반려 사유를 입력해 주세요.」 · 성공 시 사유 비움 · 실패·닫기 시 입력 유지.
 */
export function AssetRequestRejectModal({ requestId, open, onOpenChange }: AssetRequestRejectModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaId = useId();
  const errorId = `${textareaId}-error`;

  const mutation = useMutation({
    ...changeAssetRequestStatusMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '반려했어요.');
      setReason('');
      setError(null);
      onOpenChange(false);
    },
    onError: (mutationError) => {
      notifyError(mutationError instanceof Error ? mutationError.message : '반려하지 못했어요.');
    }
  });

  function handleConfirm() {
    const parsed = assetRejectFormSchema.safeParse({ reject_reason: reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '반려 사유를 입력해 주세요.');
      document.getElementById(textareaId)?.focus();
      return;
    }
    setError(null);
    mutation.mutate({
      id: requestId,
      payload: { status: 'rejected', reject_reason: parsed.data.reject_reason }
    });
  }

  return (
    <AlertModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      onConfirm={handleConfirm}
      loading={mutation.isPending}
      title='요청을 반려할까요?'
      description='반려 사유는 요청자에게 보여요. 반려한 요청은 되돌릴 수 없어요.'
      confirmLabel='반려'
      cancelLabel='닫기'
      confirmVariant='destructive'
    >
      <div className='space-y-2'>
        <Label htmlFor={textareaId}>반려 사유</Label>
        <Textarea
          id={textareaId}
          data-testid='asset-request-reject-reason'
          rows={3}
          maxLength={ASSET_REJECT_REASON_MAX}
          value={reason}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError(null);
          }}
        />
        {error ? (
          <p id={errorId} role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        ) : null}
      </div>
    </AlertModal>
  );
}
