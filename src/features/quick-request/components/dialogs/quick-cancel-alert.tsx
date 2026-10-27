'use client';

import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { notifySuccess } from '@/lib/notify';
import { cancelQuickRequestMutation } from '../../api/mutations';
import { notifyQuickRequestError } from '../../lib/quick-request-mutation-feedback';
import { QUICK_REQUEST_CANCEL_REASON_MAX_LENGTH } from '../../schemas/quick-request-cancel';

type QuickCancelAlertProps = {
  /** null이면 닫힘 */
  requestNo: string | null;
  onOpenChange: (open: boolean) => void;
};

/** 요청 취소 확인 — 사유(선택 · 200자) 입력 (AC-23). 취소 알림은 서버가 보낸다(plan 92) */
export function QuickCancelAlert({ requestNo, onOpenChange }: QuickCancelAlertProps) {
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const counterId = useId();
  const mutation = useMutation({ ...cancelQuickRequestMutation });

  function close() {
    setReason('');
    onOpenChange(false);
  }

  function handleConfirm() {
    if (!requestNo) return;
    const trimmed = reason.trim();
    mutation.mutate(
      { requestNo, payload: trimmed ? { reason: trimmed } : {} },
      {
        onSuccess: () => {
          notifySuccess('퀵 요청을 취소했습니다.');
          close();
        },
        onError: (error) => {
          if (notifyQuickRequestError(error)) {
            close();
          }
        }
      }
    );
  }

  return (
    <AlertModal
      isOpen={requestNo !== null}
      onClose={close}
      onConfirm={handleConfirm}
      loading={mutation.isPending}
      title='퀵 요청을 취소할까요?'
      description={`${requestNo ?? ''} 요청을 취소합니다. 취소한 요청은 되돌릴 수 없습니다.`}
      confirmLabel='요청 취소'
      cancelLabel='닫기'
    >
      <div className='grid gap-2'>
        <Label htmlFor={reasonId}>취소 사유 (선택)</Label>
        <Textarea
          id={reasonId}
          value={reason}
          maxLength={QUICK_REQUEST_CANCEL_REASON_MAX_LENGTH}
          placeholder='예: 일정이 변경되었습니다…'
          aria-describedby={counterId}
          className='min-h-20'
          disabled={mutation.isPending}
          data-testid='quick-cancel-reason'
          onChange={(event) => setReason(event.target.value)}
        />
        <p id={counterId} className='text-right text-xs text-muted-foreground tabular-nums'>
          {reason.length}/{QUICK_REQUEST_CANCEL_REASON_MAX_LENGTH}
        </p>
      </div>
    </AlertModal>
  );
}
