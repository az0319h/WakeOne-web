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
import { mapFormValuesToNotifyPayload } from '../lib/map-quick-request-notify';
import { getQuickRequestErrorMessage } from '../lib/quick-request-mutation-feedback';
import {
  quickRequestCreateFormSchema,
  quickRequestFormSchema,
  type QuickRequestFormValues
} from '../schemas/quick-request-form';
import { QUICK_CHAT_MOBILE_MEDIA_QUERY } from './chat/quick-chat-constants';
import { QuickRequestConfirmBoard } from './quick-request-confirm-board';
import type { QuickRequestOrderForm } from './quick-request-form-api';
import {
  QUICK_REQUEST_ENTER_NEXT_ATTR,
  QuickRequestFormLayoutProvider
} from './quick-request-form-layout';
import { QuickRequestMobileSummaryBar } from './quick-request-mobile-summary-bar';
import { QuickRequestOrderFormSections } from './quick-request-order-form-sections';
import { QuickRequestPreviewDialog } from './quick-request-preview-dialog';

/** 보이는·입력 가능한 「Enter 다음」 칸 (readonly 주소 칸·숨은 「기타」 칸 건너뜀) */
function isEnterNextCandidate(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  if (element.readOnly || element.disabled) return false;
  return element.getClientRects().length > 0;
}

/** plan 106 D-10 ⑥ · AC-25 — 다음 글자 칸으로 포커스 · 마지막이면 키보드 닫기(blur) */
function focusNextEnterTarget(formElement: HTMLFormElement, current: HTMLInputElement) {
  const candidates = Array.from(
    formElement.querySelectorAll<HTMLElement>(`[${QUICK_REQUEST_ENTER_NEXT_ATTR}]`)
  ).filter((element) => element === current || isEnterNextCandidate(element));
  const next = candidates[candidates.indexOf(current) + 1];
  if (next) {
    next.focus();
    return;
  }
  current.blur();
}

/**
 * lg 미만(터치 우선 화면)에서 글자 칸 Enter = 다음 칸 · 폼 제출(미리보기 열기) 없음.
 * PC(lg 이상)는 지금 그대로 Enter = 제출 → 미리보기. IME 조합 중 Enter는 건드리지 않는다.
 * readonly 주소 칸의 Enter는 칸 자체 keydown이 주소 검색 Dialog를 연다.
 */
function handleOrderFormKeyDownCapture(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.readOnly) return;
  if (!window.matchMedia(QUICK_CHAT_MOBILE_MEDIA_QUERY).matches) return;
  event.preventDefault();
  if (target.hasAttribute(QUICK_REQUEST_ENTER_NEXT_ATTR)) {
    focusNextEnterTarget(event.currentTarget, target);
  }
}

type QuickRequestOrderPageProps = {
  requesterName: string;
  profileDefaults: {
    full_name: string;
    phone: string | null;
  };
  /** plan 99 — 서버 `isPlaceSearchConfigured()` 결과 · 주소 검색 Dialog 「장소 검색」 탭 (기본 false) */
  placeSearchEnabled?: boolean;
};

export function QuickRequestOrderPage({
  requesterName,
  profileDefaults,
  placeSearchEnabled = false
}: QuickRequestOrderPageProps) {
  const emptyDefaults = React.useMemo(
    () => buildQuickRequestDefaultValues(profileDefaults),
    [profileDefaults]
  );

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewValues, setPreviewValues] = React.useState<QuickRequestFormValues | null>(null);
  const [requestedAt, setRequestedAt] = React.useState<Date>(() => new Date());

  const form = useAppForm({
    defaultValues: emptyDefaults,
    validationLogic: revalidateLogic(),
    // plan 106 D-11 — 등록 전용 스키마(공용 검증 + 지난 날짜·순서 검사) · 수정 Sheet는 공용만
    validators: {
      onSubmit: quickRequestCreateFormSchema as never,
      onDynamic: quickRequestCreateFormSchema as never,
      onDynamicAsyncDebounceMs: 500
    },
    onSubmit: ({ value }) => {
      const parsed = quickRequestCreateFormSchema.safeParse(value);
      if (!parsed.success) {
        notifyError('필수 항목을 확인해 주세요.');
        return;
      }
      const at = new Date();
      setRequestedAt(at);
      setPreviewValues(parsed.data);
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

  // 미리보기 확인 시점은 형식만 다시 본다 — 날짜는 미리보기 열 때 검사했고 서버가 5분 여유로 다시 검사 (AC-27)
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
      <QuickRequestFormLayoutProvider value='page'>
        <form.AppForm>
          {/* plan 106 D-10 ① — lg 미만은 페이지 전체 스크롤(안쪽 스크롤 상자 0) · lg 이상은 왼쪽 열만 스크롤 + 오른쪽 요약 */}
          <form.Form
            className='flex min-h-0 flex-1 flex-col gap-0 p-0 md:p-0'
            onKeyDownCapture={handleOrderFormKeyDownCapture}
          >
            <div data-testid='quick-request-order-page' className='flex min-h-0 flex-1 flex-col'>
              <div className='grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_24rem]'>
                <div className='relative -mx-1 min-w-0 px-1 pb-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pb-8'>
                  <QuickRequestOrderFormSections form={orderForm} placeSearchEnabled={placeSearchEnabled} />
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
      </QuickRequestFormLayoutProvider>

      <QuickRequestPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        values={previewValues}
        requesterName={requesterName}
        requestedAt={requestedAt}
        onConfirm={handleConfirmCreate}
        isPending={isRegistering}
      />
    </>
  );
}
