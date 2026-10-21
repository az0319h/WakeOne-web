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
  isPending: boolean;
};

export function QuickRequestPreviewDialog({
  open,
  onOpenChange,
  message,
  onConfirm,
  isPending
}: QuickRequestPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>카카오톡 메시지 미리보기</DialogTitle>
          <DialogDescription>
            확인 시 메시지가 복사되고, 카톡 API 연동 후 자동 전송됩니다.
          </DialogDescription>
        </DialogHeader>
        <pre
          data-testid='quick-request-preview-message'
          className='max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap'
        >
          {message}
        </pre>
        <DialogFooter className='gap-2 sm:gap-0'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type='button'
            data-testid='quick-request-confirm-button'
            isLoading={isPending}
            onClick={onConfirm}
          >
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
