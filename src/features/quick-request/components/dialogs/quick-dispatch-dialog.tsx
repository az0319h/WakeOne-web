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
import { dispatchQuickRequestMutation } from '../../api/mutations';
import { parseQuickAmountInput } from '../../lib/format-quick-amount';
import {
  notifyQuickOpenchatOutcome,
  notifyQuickRequestError
} from '../../lib/quick-request-mutation-feedback';
import {
  QUICK_REQUEST_DISPATCH_FORM_DEFAULTS,
  quickRequestDispatchFormSchema
} from '../../schemas/quick-request-dispatch';
import { QuickDispatchFields, type QuickDispatchFieldsForm } from './quick-dispatch-fields';

const FORM_ID = 'quick-dispatch-form';

type QuickDispatchDialogProps = {
  /** null이면 닫힘 */
  requestNo: string | null;
  onOpenChange: (open: boolean) => void;
};

/** 배차 완료 Dialog — 4필드 필수 · 클라이언트 검증 실패 시 요청을 보내지 않는다 (AC-17) */
export function QuickDispatchDialog({ requestNo, onOpenChange }: QuickDispatchDialogProps) {
  const mutation = useMutation({ ...dispatchQuickRequestMutation });
  const isPending = mutation.isPending;

  const form = useAppForm({
    defaultValues: QUICK_REQUEST_DISPATCH_FORM_DEFAULTS,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: quickRequestDispatchFormSchema },
    onSubmit: async ({ value }) => {
      if (!requestNo) return;
      const parsed = quickRequestDispatchFormSchema.safeParse(value);
      const estimatedAmount = parseQuickAmountInput(value.estimatedAmount);
      if (!parsed.success || estimatedAmount == null) return;

      try {
        const result = await mutation.mutateAsync({
          requestNo,
          payload: {
            estimatedAmount,
            vehicleInfo: parsed.data.vehicleInfo,
            driverName: parsed.data.driverName,
            driverPhone: parsed.data.driverPhone
          }
        });
        notifySuccess('배차 완료를 등록했습니다.');
        notifyQuickOpenchatOutcome(result.openchat);
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
    <Dialog open={requestNo !== null} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid='quick-dispatch-dialog'
        className='max-h-[90dvh] overflow-y-auto sm:max-w-md'
      >
        <DialogHeader>
          <DialogTitle>배차 완료</DialogTitle>
          <DialogDescription>
            {requestNo} 요청의 배차 정보를 입력합니다. 저장하면 오픈채팅으로 안내됩니다.
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form.Form id={FORM_ID} className='flex min-w-0 flex-col gap-4'>
            <QuickDispatchFields
              form={form as unknown as QuickDispatchFieldsForm}
              vehicleInfoName='vehicleInfo'
              testIdPrefix='quick-dispatch'
            />
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
            data-testid='quick-dispatch-submit'
          >
            배차 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
