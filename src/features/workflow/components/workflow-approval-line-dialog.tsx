'use client';

import { useState } from 'react';
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
import { notifyError, notifySuccess } from '@/lib/notify';
import { changeWorkflowApprovalLineMutation } from '../api/mutations';
import type { WorkflowDocumentDetail } from '../api/types';
import { validateApprovalLine } from '../lib/approval-line-rules';
import {
  lineFromDocument,
  lineToPayload,
  type WorkflowLineValue
} from '../lib/approval-line-state';
import { WorkflowApprovalLineEditor } from './workflow-approval-line-editor';

function ApprovalLineForm({
  document,
  onDone
}: {
  document: WorkflowDocumentDetail;
  onDone: () => void;
}) {
  const [line, setLine] = useState<WorkflowLineValue>(() => lineFromDocument(document, { withStatus: true }));
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({ ...changeWorkflowApprovalLineMutation });

  function handleSave() {
    const payload = lineToPayload(line);
    const message = validateApprovalLine(payload, { writerId: document.writer.user_id });
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    mutation.mutate(
      { id: document.id, payload },
      {
        onSuccess: () => {
          notifySuccess('승인·참조자를 변경했습니다.');
          onDone();
        },
        onError: (mutationError) => notifyError(mutationError.message)
      }
    );
  }

  return (
    <>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-1'>
        <WorkflowApprovalLineEditor
          mode='change'
          value={line}
          onChange={(next) => {
            setLine(next);
            if (error) setError(validateApprovalLine(lineToPayload(next), { writerId: document.writer.user_id }));
          }}
          writerId={document.writer.user_id}
          error={error}
          showTitle={false}
        />
      </div>
      <DialogFooter className='gap-2'>
        <Button
          type='button'
          variant='outline'
          className='h-11 sm:h-9'
          disabled={mutation.isPending}
          onClick={onDone}
        >
          취소
        </Button>
        <Button type='button' className='h-11 sm:h-9' isLoading={mutation.isPending} onClick={handleSave}>
          저장
        </Button>
      </DialogFooter>
    </>
  );
}

/** 상세 `···` → 승인·참조 변경 (designer §5.3) */
export function WorkflowApprovalLineDialog({
  open,
  onOpenChange,
  document
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: WorkflowDocumentDetail;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90dvh] flex-col sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>승인·참조 변경</DialogTitle>
          <DialogDescription>완료된 단계는 바꿀 수 없어요.</DialogDescription>
        </DialogHeader>
        {open ? <ApprovalLineForm document={document} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
