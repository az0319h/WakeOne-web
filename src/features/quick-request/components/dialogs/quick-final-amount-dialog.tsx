'use client';

import { revalidateLogic } from '@tanstack/react-form';
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
import { scrollToFirstError } from '@/components/ui/form-context';
import { useAppForm } from '@/components/ui/tanstack-form';
import { notifySuccess } from '@/lib/notify';
import { setQuickRequestFinalAmountMutation } from '../../api/mutations';
import { formatQuickAmountWon, parseQuickAmountInput } from '../../lib/format-quick-amount';
import { notifyQuickRequestError } from '../../lib/quick-request-mutation-feedback';
import {
  quickRequestFinalAmountFormSchema,
  type QuickRequestFinalAmountFormValues
} from '../../schemas/quick-request-dispatch';
import { QUICK_AMOUNT_VAT_INCLUDED_DESCRIPTION, QuickAmountInputField } from './quick-dispatch-fields';

const FORM_ID = 'quick-final-amount-form';
const DEFAULT_VALUES: QuickRequestFinalAmountFormValues = { finalAmount: '' };

export type QuickFinalAmountTarget = {
  requestNo: string;
  estimatedAmount: number | null;
};

type QuickFinalAmountDialogProps = {
  /** null이면 닫힘 */
  target: QuickFinalAmountTarget | null;
  onOpenChange: (open: boolean) => void;
};

/** 최종금액 입력 Dialog (처음 입력 — 이미 입력된 금액 수정은 수정 Sheet) */
export function QuickFinalAmountDialog({ target, onOpenChange }: QuickFinalAmountDialogProps) {
  const mutation = useMutation({ ...setQuickRequestFinalAmountMutation });
  const isPending = mutation.isPending;

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: quickRequestFinalAmountFormSchema },
    onSubmit: async ({ value }) => {
      const finalAmount = parseQuickAmountInput(value.finalAmount);
      if (!target || finalAmount == null) return;

      try {
        await mutation.mutateAsync({ requestNo: target.requestNo, finalAmount });
        notifySuccess('최종금액을 저장했습니다.');
        form.reset();
        onOpenChange(false);
      } catch (error) {
        if (notifyQuickRequestError(error)) {
          onOpenChange(false);
        }
      }
    },
    onSubmitInvalid: () => scrollToFirstError()
  });

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) {
      form.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={target !== null} onOpenChange={handleOpenChange}>
      <DialogContent data-testid='quick-final-amount-dialog' className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>최종금액 입력</DialogTitle>
          <DialogDescription>
            운송 완료 후 실제 금액을 입력합니다. 저장하면 요청자에게 승인 요청 알림이 갑니다.
          </DialogDescription>
        </DialogHeader>
        <p className='text-sm text-muted-foreground tabular-nums'>
          예상금액 {formatQuickAmountWon(target?.estimatedAmount)}(부가세 포함)
        </p>
        <form.AppForm>
          <form.Form id={FORM_ID} className='flex min-w-0 flex-col gap-4'>
            <form.AppField name='finalAmount'>
              {() => (
                <QuickAmountInputField
                  label='최종금액'
                  description={QUICK_AMOUNT_VAT_INCLUDED_DESCRIPTION}
                  required
                  data-testid='quick-final-amount-input'
                />
              )}
            </form.AppField>
          </form.Form>
        </form.AppForm>
        <DialogFooter className='gap-2'>
          <Button
            type='button'
            variant='outline'
            className='h-11 sm:h-9'
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type='submit'
            form={FORM_ID}
            className='h-11 sm:h-9'
            isLoading={isPending}
            data-testid='quick-final-amount-submit'
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
