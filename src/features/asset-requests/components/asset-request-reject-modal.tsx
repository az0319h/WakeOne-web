'use client';

import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
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
 * 반려 (plan D-14 · AC-30) — 확인 Dialog + 사유 Textarea(필수 · 요청자에게 보임).
 * AlertModal은 DialogContent className을 받지 않아 휴대폰 위쪽 정렬을 위해 같은 구성을 Dialog로 직접 쓴다.
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

  const loading = mutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // AlertModal과 같이 처리 중에는 닫지 않는다
        if (!next && !loading) onOpenChange(false);
      }}
    >
      {/* 휴대폰: 가운데 정렬이면 iOS 키보드가 버튼을 가린다 → 위쪽 정렬 + 내부 스크롤 */}
      <DialogContent className='max-h-[90dvh] overflow-y-auto overscroll-contain max-sm:top-4 max-sm:translate-y-0'>
        <DialogHeader>
          <DialogTitle>요청을 반려할까요?</DialogTitle>
          <DialogDescription>반려 사유는 요청자에게 보여요. 반려한 요청은 되돌릴 수 없어요.</DialogDescription>
        </DialogHeader>
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
        {/* 휴대폰(md 미만): 확인 위 · 닫기 아래 세로 44px / md↑: 오른쪽 정렬 가로 h-9 (AlertModal과 동일) */}
        <DialogFooter className='pt-2 sm:flex-col-reverse md:flex-row md:items-center md:justify-end'>
          <Button
            type='button'
            variant='outline'
            disabled={loading}
            className='h-11 w-full md:h-9 md:w-auto'
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
          <Button
            type='button'
            variant='destructive'
            isLoading={loading}
            className='h-11 w-full md:h-9 md:w-auto'
            onClick={handleConfirm}
          >
            반려
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
