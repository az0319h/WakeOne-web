'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { QuickRequestFormValues } from '../schemas/quick-request-form';
import { QuickRequestPreviewCard } from './quick-request-preview-card';

type QuickRequestPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** schema 통과한 폼 값 — 열리기 전엔 null */
  values: QuickRequestFormValues | null;
  requesterName: string;
  requestedAt: Date;
  onConfirm: () => void;
  /** 등록 요청 중 + 상세로 이동 중 — 닫기·재클릭 차단 */
  isPending: boolean;
};

/** plan 89 U-8 · 96 D-1 — 등록 전 구조화 미리보기. 「등록」하면 DB 저장 후 상세로 이동한다 */
export function QuickRequestPreviewDialog({
  open,
  onOpenChange,
  values,
  requesterName,
  requestedAt,
  onConfirm,
  isPending
}: QuickRequestPreviewDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className='flex max-h-[90vh] flex-col gap-4 sm:max-w-lg lg:max-w-2xl'>
        <DialogHeader className='shrink-0'>
          <DialogTitle>퀵 요청 미리보기</DialogTitle>
          <DialogDescription>
            등록하면 요청번호가 발급되고 동방특송 담당자에게 WakeOne 알림이 갑니다.
          </DialogDescription>
        </DialogHeader>
        <div className='-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1'>
          {values ? (
            <QuickRequestPreviewCard
              values={values}
              requesterName={requesterName}
              requestedAt={requestedAt}
            />
          ) : null}
        </div>
        <DialogFooter className='shrink-0'>
          <Button
            type='button'
            variant='outline'
            className='min-h-11 sm:min-h-9'
            data-testid='quick-request-preview-cancel'
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type='button'
            className='min-h-11 sm:min-h-9'
            data-testid='quick-request-confirm-button'
            isLoading={isPending}
            onClick={onConfirm}
          >
            등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
