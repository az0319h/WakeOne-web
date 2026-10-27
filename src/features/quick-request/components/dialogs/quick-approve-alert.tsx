'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { notifySuccess } from '@/lib/notify';
import { approveQuickRequestMutation } from '../../api/mutations';
import { formatQuickAmountWon } from '../../lib/format-quick-amount';
import { notifyQuickRequestError } from '../../lib/quick-request-mutation-feedback';

export type QuickApproveTarget = {
  requestNo: string;
  finalAmount: number | null;
};

type QuickApproveAlertProps = {
  /** null이면 닫힘 */
  target: QuickApproveTarget | null;
  onOpenChange: (open: boolean) => void;
};

/** 승인 확인 — 파괴적 동작이 아니므로 확인 버튼은 primary (designer K4) */
export function QuickApproveAlert({ target, onOpenChange }: QuickApproveAlertProps) {
  const mutation = useMutation({ ...approveQuickRequestMutation });

  function handleConfirm() {
    if (!target) return;
    mutation.mutate(target.requestNo, {
      onSuccess: () => {
        notifySuccess('퀵 요청을 승인했습니다.');
        onOpenChange(false);
      },
      onError: (error) => {
        if (notifyQuickRequestError(error)) {
          onOpenChange(false);
        }
      }
    });
  }

  return (
    <AlertModal
      isOpen={target !== null}
      onClose={() => onOpenChange(false)}
      onConfirm={handleConfirm}
      loading={mutation.isPending}
      confirmVariant='default'
      title='퀵 요청 승인'
      description={`${target?.requestNo ?? ''} 최종금액 ${formatQuickAmountWon(target?.finalAmount)}을 승인합니다. 승인한 뒤에는 변경할 수 없습니다.`}
      confirmLabel='승인'
      cancelLabel='닫기'
    />
  );
}
