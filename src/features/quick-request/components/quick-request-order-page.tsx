'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { revalidateLogic, useStore } from '@tanstack/react-form';
import { scrollToFirstError } from '@/components/ui/form-context';
import { useAppForm } from '@/components/ui/tanstack-form';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';
import {
  notifyQuickRequestMutation,
  recordQuickRequestRecentAddressesMutation
} from '../api/mutations';
import type { QuickRequestLocation } from '../api/types';
import { buildQuickRequestDefaultValues } from '../lib/default-form-values';
import { formatQuickRequestKakaoMessage } from '../lib/format-quick-request-message';
import { mapFormValuesToNotifyPayload } from '../lib/map-quick-request-notify';
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
      setPreviewMessage(formatQuickRequestKakaoMessage(parsed.data, requesterName, at));
      setPreviewOpen(true);
    },
    onSubmitInvalid: () => {
      notifyError('필수 항목을 확인해 주세요.');
      scrollToFirstError();
    }
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const orderForm = form as unknown as QuickRequestOrderForm;

  const notifyMutation = useMutation({
    ...notifyQuickRequestMutation,
    onSuccess: async (result) => {
      try {
        await navigator.clipboard.writeText(previewMessage);
        notifySuccess('메시지가 복사되었습니다.');
      } catch {
        notifyError('클립보드 복사에 실패했습니다. 미리보기에서 직접 복사해 주세요.');
      }

      if (result.httpStatus === 501 || !result.success) {
        notifyInfo(result.message || '카톡 API 연동 후 자동 전송됩니다.');
      } else if (result.success) {
        notifySuccess('퀵 요청이 전송되었습니다.');
      }

      if (result.redirectUrl) {
        window.open(result.redirectUrl, '_blank', 'noopener,noreferrer');
      }

      setPreviewOpen(false);
      form.reset(emptyDefaults);
    },
    onError: () => {
      notifyError('퀵 요청 전송에 실패했습니다.');
    }
  });

  // 최근 주소 기록 실패는 복사·reset 흐름과 무관 — toast 1회만 (plan 87 AC-22)
  const recordRecentMutation = useMutation({
    ...recordQuickRequestRecentAddressesMutation,
    onError: () => {
      notifyError('최근 이용 내역을 저장하지 못했습니다.');
    }
  });

  function handleConfirmNotify() {
    const parsed = quickRequestFormSchema.safeParse(form.state.values);
    if (!parsed.success) {
      notifyError('필수 항목을 확인해 주세요.');
      return;
    }
    const payload = mapFormValuesToNotifyPayload(
      parsed.data,
      requesterName,
      requestedAt.toISOString()
    );
    const locations: QuickRequestLocation[] = [
      payload.origin,
      ...payload.stopovers,
      payload.destination
    ].map(({ roadAddress, detailAddress, contactName, contactPhone }) => ({
      roadAddress,
      detailAddress,
      contactName,
      contactPhone
    }));

    // notify(501 placeholder)와 최근 주소 기록을 병렬로 보낸다
    notifyMutation.mutate(payload);
    recordRecentMutation.mutate(locations);
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
        onConfirm={handleConfirmNotify}
        isPending={notifyMutation.isPending}
      />
    </>
  );
}
