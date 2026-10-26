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

type QuickRequestPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onConfirm: () => void;
  /** 등록 요청 중 + 상세로 이동 중 — 닫기·재클릭 차단 */
  isPending: boolean;
};

/** plan 89 U-8 — 등록 전 미리보기. 「등록」하면 DB 저장 후 상세로 이동한다 */
export function QuickRequestPreviewDialog({
  open,
  onOpenChange,
  message,
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
      <DialogContent className='max-h-[90vh] sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>퀵 요청 미리보기</DialogTitle>
          <DialogDescription>
            등록하면 요청번호가 발급되고 동방특송 오픈채팅방에 자동으로 안내됩니다.
          </DialogDescription>
        </DialogHeader>
        <p className='text-xs text-muted-foreground'>요청번호는 등록 후 발급됩니다.</p>
        <pre
          data-testid='quick-request-preview-message'
          className='max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap'
        >
          {message}
        </pre>
        <DialogFooter className='gap-2 sm:gap-0'>
          <Button
            type='button'
            variant='outline'
            className='h-11 sm:h-9'
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type='button'
            className='h-11 sm:h-9'
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
