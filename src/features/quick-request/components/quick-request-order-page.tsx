'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { revalidateLogic, useStore } from '@tanstack/react-form';
import { scrollToFirstError } from '@/components/ui/form-context';
import { useAppForm } from '@/components/ui/tanstack-form';
import { notifyError, notifySuccess } from '@/lib/notify';
import { createQuickRequestMutation } from '../api/mutations';
import { buildQuickRequestDefaultValues } from '../lib/default-form-values';
import { formatQuickRequestPreviewText } from '../lib/format-quick-request-message';
import { mapFormValuesToNotifyPayload } from '../lib/map-quick-request-notify';
import { getQuickRequestErrorMessage } from '../lib/quick-request-mutation-feedback';
import { quickRequestFormSchema } from '../schemas/quick-request-form';
import { QuickRequestConfirmBoard } from './quick-request-confirm-board';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import { QuickRequestMobileSummaryBar } from './quick-request-mobile-summary-bar';
import { QuickRequestOrderFormSections } from './quick-request-order-form-sections';
import { QuickRequestPreviewDialog } from './quick-request-preview-dialog';

type QuickRequestOrderPageProps = {
  requesterName: string;
  profileDefaults: {
    full_name: string;
    phone: string | null;
  };
};

export function QuickRequestOrderPage({
  requesterName,
  profileDefaults
}: QuickRequestOrderPageProps) {
  const emptyDefaults = React.useMemo(
    () => buildQuickRequestDefaultValues(profileDefaults),
    [profileDefaults]
  );

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewMessage, setPreviewMessage] = React.useState('');
  const [requestedAt, setRequestedAt] = React.useState<Date>(() => new Date());

  const form = useAppForm({
    defaultValues: emptyDefaults,
    validationLogic: revalidateLogic(),
    validators: {
      onSubmit: quickRequestFormSchema as never,
      onDynamic: quickRequestFormSchema as never,
      onDynamicAsyncDebounceMs: 500
    },
    onSubmit: ({ value }) => {
      const parsed = quickRequestFormSchema.safeParse(value);
      if (!parsed.success) {
        notifyError('필수 항목을 확인해 주세요.');
        return;
      }
      const at = new Date();
      setRequestedAt(at);
      setPreviewMessage(formatQuickRequestPreviewText(parsed.data, requesterName, at));
      setPreviewOpen(true);
    },
    onSubmitInvalid: () => {
      notifyError('필수 항목을 확인해 주세요.');
      scrollToFirstError();
    }
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const orderForm = form as unknown as QuickRequestOrderForm;

  const router = useRouter();
  // 등록 성공 후 상세로 이동이 끝날 때까지 Dialog·Spinner 유지 (재클릭 중복 등록 방지)
  const [isNavigating, startNavigation] = React.useTransition();

  // plan 89·92 — 등록 = DB 저장 + 서버가 WakeOne 알림 발송·최근 주소 기록 (클립보드 복사·reset 없음)
  const createMutation = useMutation({
    ...createQuickRequestMutation,
    onSuccess: (result) => {
      notifySuccess(`퀵 요청이 등록되었습니다. (요청번호 ${result.requestNo})`);
      startNavigation(() => {
        router.push(`/dashboard/quick/${encodeURIComponent(result.requestNo)}`);
      });
    },
    onError: (error) => {
      notifyError(getQuickRequestErrorMessage(error));
    }
  });

  const isRegistering = createMutation.isPending || createMutation.isSuccess || isNavigating;

  function handleConfirmCreate() {
    if (isRegistering) return;
    const parsed = quickRequestFormSchema.safeParse(form.state.values);
    if (!parsed.success) {
      notifyError('필수 항목을 확인해 주세요.');
      return;
    }
    createMutation.mutate(
      mapFormValuesToNotifyPayload(parsed.data, requesterName, requestedAt.toISOString())
    );
  }

  // 데스크톱 aside · 모바일 바 · Drawer 공용 — 검증 실패 시 onSubmitInvalid
  function handleRegister() {
    void form.handleSubmit();
  }

  return (
    <>
      <form.AppForm>
        <form.Form className='flex min-h-0 flex-1 flex-col gap-0 p-0 md:p-0'>
          <div data-testid='quick-request-order-page' className='flex min-h-0 flex-1 flex-col'>
            <div className='grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]'>
              <div className='relative -mx-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-1 pb-8'>
                <QuickRequestOrderFormSections form={orderForm} />
              </div>
              <form.Subscribe selector={(state) => state.values}>
                {(values) => (
                  <QuickRequestConfirmBoard
                    values={values}
                    isSubmitting={isSubmitting}
                    onRegister={handleRegister}
                  />
                )}
              </form.Subscribe>
            </div>
            <form.Subscribe selector={(state) => state.values}>
              {(values) => (
                <QuickRequestMobileSummaryBar
                  values={values}
                  isSubmitting={isSubmitting}
                  onRegister={handleRegister}
                />
              )}
            </form.Subscribe>
          </div>
        </form.Form>
      </form.AppForm>

      <QuickRequestPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        message={previewMessage}
        onConfirm={handleConfirmCreate}
        isPending={isRegistering}
      />
    </>
  );
}
