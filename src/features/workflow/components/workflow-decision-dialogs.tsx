'use client';

import { useId, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  approveWorkflowDocumentMutation,
  declineWorkflowDocumentMutation
} from '../api/mutations';

type DecisionKind = 'approve' | 'decline';

const COPY: Record<
  DecisionKind,
  {
    title: string;
    description: (code: string) => string;
    label: string;
    placeholder: string;
    confirm: string;
    success: string;
  }
> = {
  approve: {
    title: '승인',
    description: (code) => `${code} 문서를 승인합니다.`,
    label: '의견 (선택)',
    placeholder: '의견을 입력해 주세요…',
    confirm: '승인',
    success: '승인했습니다.'
  },
  decline: {
    title: '반려',
    description: (code) => `${code} 문서를 반려합니다. 반려하면 이후 단계는 진행하지 않아요.`,
    label: '반려 사유 (선택)',
    placeholder: '반려 사유를 입력해 주세요…',
    confirm: '반려',
    success: '반려했습니다.'
  }
};

const MAX_LENGTH = 2000;

/** 승인 · 반려 Dialog (입력이 있으므로 AlertModal 대신 Dialog — designer §3.12) */
export function WorkflowDecisionDialog({
  kind,
  open,
  onOpenChange,
  documentId,
  code
}: {
  kind: DecisionKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  code: string;
}) {
  const [text, setText] = useState('');
  const textareaId = useId();
  const approve = useMutation({ ...approveWorkflowDocumentMutation });
  const decline = useMutation({ ...declineWorkflowDocumentMutation });
  const isPending = approve.isPending || decline.isPending;
  const copy = COPY[kind];

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    onOpenChange(next);
    if (!next) setText('');
  }

  function handleConfirm() {
    const value = text.trim();
    const callbacks = {
      onSuccess: () => {
        notifySuccess(copy.success);
        setText('');
        onOpenChange(false);
      },
      onError: (error: Error) => notifyError(error.message)
    };
    if (kind === 'approve') {
      approve.mutate({ id: documentId, opinion: value }, callbacks);
    } else {
      decline.mutate({ id: documentId, reason: value }, callbacks);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* 휴대폰: 가운데 정렬이면 iOS 키보드가 버튼을 가린다 → 위쪽 정렬 + 내부 스크롤 */}
      <DialogContent className='max-h-[90dvh] overflow-y-auto overscroll-contain max-sm:top-4 max-sm:translate-y-0 sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description(code)}</DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          <Label htmlFor={textareaId}>{copy.label}</Label>
          <Textarea
            id={textareaId}
            value={text}
            maxLength={MAX_LENGTH}
            placeholder={copy.placeholder}
            className='min-h-24'
            onChange={(event) => setText(event.target.value)}
          />
        </div>
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
            type='button'
            variant={kind === 'decline' ? 'destructive' : 'default'}
            className='h-11 sm:h-9'
            isLoading={isPending}
            onClick={handleConfirm}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
