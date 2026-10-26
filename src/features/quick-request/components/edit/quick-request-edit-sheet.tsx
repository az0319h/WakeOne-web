'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/components/ui/dialog';
import { scrollToFirstError } from '@/components/ui/form-context';
import { useAppForm } from '@/components/ui/tanstack-form';
import { Icons } from '@/components/icons';
import { notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { updateQuickRequestMutation } from '../../api/mutations';
import type { QuickRequestDetail } from '../../api/types';
import {
  buildQuickRequestPatchCandidate,
  diffQuickRequestPatch,
  mapQuickRequestDetailToForm
} from '../../lib/map-quick-request-detail-to-form';
import {
  isQuickRequestConflictError,
  notifyQuickRequestError
} from '../../lib/quick-request-mutation-feedback';
import { QUICK_REQUEST_STATUS_LABELS } from '../../lib/quick-request-status';
import {
  buildQuickRequestEditFormSchema,
  type QuickRequestEditFormValues
} from '../../schemas/quick-request-edit';
import type { QuickDispatchFieldsForm } from '../dialogs/quick-dispatch-fields';
import { QuickRequestAddressSection } from '../quick-request-address-section';
import type { QuickRequestOrderForm } from '../quick-request-form-api';
import { QuickRequestFreightSection } from '../quick-request-freight-section';
import { QuickRequestGoodsSection } from '../quick-request-goods-section';
import { QuickRequestScheduleSection } from '../quick-request-schedule-section';
import { QuickRequestVehicleSection } from '../quick-request-vehicle-section';
import { QuickRequestEditDispatchSection } from './quick-request-edit-dispatch-section';
import { QuickRequestEditNotesSection } from './quick-request-edit-notes-section';

const FORM_ID = 'quick-edit-form';
const DESCRIPTION_ID = 'quick-edit-sheet-description';

type EditFormProps = {
  detail: QuickRequestDetail;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onDone: () => void;
  onCancelClick: () => void;
};

/** Sheet 본문 + 하단 CTA — 열릴 때마다 최신 detail로 새로 마운트된다 */
function QuickRequestEditForm({
  detail,
  onDirtyChange,
  onPendingChange,
  onDone,
  onCancelClick
}: EditFormProps) {
  const includeDispatch = detail.status === 'dispatched';
  const hasFinalAmount = detail.finalAmount != null;
  const defaultValues = React.useMemo(() => mapQuickRequestDetailToForm(detail), [detail]);
  const schema = React.useMemo(
    () => buildQuickRequestEditFormSchema({ status: detail.status, hasFinalAmount }),
    [detail.status, hasFinalAmount]
  );
  const initialCandidate = React.useMemo(
    () => buildQuickRequestPatchCandidate(defaultValues, { includeDispatch }),
    [defaultValues, includeDispatch]
  );

  const mutation = useMutation({ ...updateQuickRequestMutation });

  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema as never },
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) return;
      const payload = diffQuickRequestPatch(
        initialCandidate,
        buildQuickRequestPatchCandidate(value as QuickRequestEditFormValues, { includeDispatch })
      );
      if (Object.keys(payload).length === 0) return;

      try {
        await mutation.mutateAsync({ requestNo: detail.requestNo, payload });
        notifySuccess('퀵 요청을 수정했습니다.');
        form.reset();
        onDone();
      } catch (error) {
        notifyQuickRequestError(error);
        if (isQuickRequestConflictError(error)) {
          onDone();
        } else {
          scrollToFirstError();
        }
      }
    },
    onSubmitInvalid: () => scrollToFirstError()
  });

  const values = useStore(form.store, (state) => state.values) as QuickRequestEditFormValues;
  const hasChanges = React.useMemo(
    () =>
      Object.keys(
        diffQuickRequestPatch(
          initialCandidate,
          buildQuickRequestPatchCandidate(values, { includeDispatch })
        )
      ).length > 0,
    [includeDispatch, initialCandidate, values]
  );

  React.useEffect(() => {
    onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  React.useEffect(() => {
    onPendingChange(mutation.isPending);
  }, [mutation.isPending, onPendingChange]);

  const sectionForm = form as unknown as QuickRequestOrderForm;

  return (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-6'>
        <form.AppForm>
          <form.Form id={FORM_ID} className='flex min-w-0 flex-col gap-0 p-0 md:p-0'>
            <div className='min-w-0 space-y-10'>
              <QuickRequestAddressSection form={sectionForm} showRecentAddresses={false} />
              <QuickRequestVehicleSection form={sectionForm} />
              <QuickRequestScheduleSection form={sectionForm} />
              <QuickRequestGoodsSection form={sectionForm} />
              <QuickRequestEditNotesSection
                form={sectionForm}
                initialOriginNotes={detail.origin.notes}
                initialDestinationNotes={detail.destination.notes}
              />
              <QuickRequestFreightSection form={sectionForm} />
              {includeDispatch ? (
                <QuickRequestEditDispatchSection
                  form={form as unknown as QuickDispatchFieldsForm}
                  hasFinalAmount={hasFinalAmount}
                />
              ) : null}
            </div>
          </form.Form>
        </form.AppForm>
      </div>
      <footer className='flex shrink-0 items-center gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6'>
        <p aria-live='polite' className='min-w-0 flex-1 text-xs text-muted-foreground'>
          {hasChanges ? '' : '변경된 내용이 없습니다.'}
        </p>
        <Button
          type='button'
          variant='outline'
          className='h-11'
          disabled={mutation.isPending}
          onClick={onCancelClick}
        >
          취소
        </Button>
        <Button
          type='submit'
          form={FORM_ID}
          className='h-11'
          isLoading={mutation.isPending}
          disabled={!hasChanges}
          data-testid='quick-edit-save'
        >
          저장
        </Button>
      </footer>
    </>
  );
}

type QuickRequestEditSheetProps = {
  detail: QuickRequestDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * 수정 Sheet (동방·admin) — PC 오른쪽 패널 · 모바일 전체 화면 (designer K3).
 * vaul Drawer 대신 Dialog 조합: 안에서 주소 검색 Dialog가 또 열리므로 포커스·스크롤 충돌을 피한다.
 */
export function QuickRequestEditSheet({ detail, open, onOpenChange }: QuickRequestEditSheetProps) {
  const dirtyRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const [guardOpen, setGuardOpen] = React.useState(false);

  const handleDirtyChange = React.useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);
  const handlePendingChange = React.useCallback((pending: boolean) => {
    pendingRef.current = pending;
  }, []);

  const close = React.useCallback(() => {
    dirtyRef.current = false;
    setGuardOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  /** 닫기 요청 — 변경이 있으면 이탈 확인 (88 AC-34 선례) */
  const requestClose = React.useCallback(() => {
    if (pendingRef.current) return;
    if (dirtyRef.current) {
      setGuardOpen(true);
      return;
    }
    close();
  }, [close]);

  function guardEvent(event: Event) {
    if (pendingRef.current || dirtyRef.current) {
      event.preventDefault();
      requestClose();
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            onOpenChange(true);
          } else {
            requestClose();
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            data-testid='quick-edit-sheet'
            aria-describedby={DESCRIPTION_ID}
            onEscapeKeyDown={guardEvent}
            onInteractOutside={guardEvent}
            className={cn(
              'fixed inset-0 z-50 flex h-dvh w-full flex-col bg-background shadow-lg outline-none',
              'md:left-auto md:w-[min(42rem,calc(100vw-4rem))] md:border-l',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
              'md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right motion-reduce:animate-none'
            )}
          >
            <header className='flex shrink-0 items-start gap-3 border-b px-4 py-3 md:px-6'>
              <div className='min-w-0 flex-1 space-y-1'>
                <DialogTitle className='text-base font-semibold'>퀵 요청 수정</DialogTitle>
                <DialogDescription id={DESCRIPTION_ID} className='text-sm text-muted-foreground tabular-nums'>
                  {detail.requestNo} · {QUICK_REQUEST_STATUS_LABELS[detail.status]}
                </DialogDescription>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-11 shrink-0'
                aria-label='닫기'
                data-testid='quick-edit-close'
                onClick={requestClose}
              >
                <Icons.close className='size-5' aria-hidden />
              </Button>
            </header>
            <QuickRequestEditForm
              detail={detail}
              onDirtyChange={handleDirtyChange}
              onPendingChange={handlePendingChange}
              onDone={close}
              onCancelClick={requestClose}
            />
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <AlertModal
        isOpen={guardOpen}
        onClose={() => setGuardOpen(false)}
        onConfirm={close}
        loading={false}
        title='수정을 그만둘까요?'
        description='저장하지 않은 수정 내용은 사라집니다.'
        confirmLabel='나가기'
        cancelLabel='계속 수정'
      />
    </>
  );
}
