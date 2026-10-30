'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { notifyError } from '@/lib/notify';
import { cn, formatBytes } from '@/lib/utils';
import {
  deleteWorkflowAttachmentMutation,
  uploadWorkflowAttachmentMutation
} from '../api/mutations';
import type { WorkflowAttachment } from '../api/types';
import {
  WORKFLOW_ATTACHMENT_MAX_BYTES,
  WORKFLOW_ATTACHMENT_MAX_COUNT,
  WORKFLOW_MESSAGES
} from '../lib/required-rules';
import { WorkflowFileIcon } from './workflow-attachment-list';

export type WorkflowAttachmentItem = {
  key: string;
  status: 'uploading' | 'done' | 'error';
  fileName: string;
  size: number;
  mimeType: string | null;
  attachment?: WorkflowAttachment;
  file?: File;
  /** 이미 문서에 붙은 첨부 (수정 모드) — 제거는 저장 시 PATCH remove_attachment_ids */
  bound: boolean;
};

function fromAttachment(attachment: WorkflowAttachment, bound: boolean): WorkflowAttachmentItem {
  return {
    key: attachment.id,
    status: 'done',
    fileName: attachment.file_name,
    size: attachment.size_bytes,
    mimeType: attachment.mime_type,
    attachment,
    bound
  };
}

/** 작성 폼 첨부 상태 — prepare → PUT → complete, staged 삭제, 수정 모드 bound 제거 */
export function useWorkflowAttachments(input: { initial: WorkflowAttachment[]; bound: boolean }) {
  const [items, setItems] = useState<WorkflowAttachmentItem[]>(() =>
    input.initial.map((attachment) => fromAttachment(attachment, input.bound))
  );
  const [removedBoundIds, setRemovedBoundIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const uploadMutation = useMutation({ ...uploadWorkflowAttachmentMutation });
  const deleteMutation = useMutation({ ...deleteWorkflowAttachmentMutation });
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const keySeq = useRef(0);

  const uploadOne = useCallback(
    async (key: string, file: File) => {
      const existingCount = itemsRef.current.filter(
        (item) => item.key !== key && item.status !== 'error'
      ).length;
      try {
        const attachment = await uploadMutation.mutateAsync({ file, existingCount });
        setItems((current) =>
          current.map((item) => (item.key === key ? fromAttachment(attachment, false) : item))
        );
      } catch (error) {
        const text = error instanceof Error ? error.message : '첨부파일을 올리지 못했습니다.';
        setMessage(text);
        setItems((current) =>
          current.map((item) => (item.key === key ? { ...item, status: 'error' } : item))
        );
      }
    },
    [uploadMutation]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      let activeCount = itemsRef.current.filter((item) => item.status !== 'error').length;
      const accepted: WorkflowAttachmentItem[] = [];
      let lastError: string | null = null;
      for (const file of files) {
        if (file.size > WORKFLOW_ATTACHMENT_MAX_BYTES) {
          lastError = WORKFLOW_MESSAGES.attachmentTooLarge;
          continue;
        }
        if (activeCount >= WORKFLOW_ATTACHMENT_MAX_COUNT) {
          lastError = WORKFLOW_MESSAGES.attachmentTooMany;
          continue;
        }
        activeCount += 1;
        keySeq.current += 1;
        accepted.push({
          key: `pending-${keySeq.current}`,
          status: 'uploading',
          fileName: file.name,
          size: file.size,
          mimeType: file.type || null,
          file,
          bound: false
        });
      }
      setMessage(lastError);
      if (accepted.length === 0) return;
      setItems((current) => [...current, ...accepted]);
      for (const item of accepted) {
        if (item.file) void uploadOne(item.key, item.file);
      }
    },
    [uploadOne]
  );

  const retry = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((entry) => entry.key === key);
      if (!item?.file) return;
      setMessage(null);
      setItems((current) =>
        current.map((entry) => (entry.key === key ? { ...entry, status: 'uploading' } : entry))
      );
      void uploadOne(key, item.file);
    },
    [uploadOne]
  );

  /** 확인 후 제거 (bound는 로컬 표시만, staged는 DELETE) */
  const remove = useCallback(
    async (key: string) => {
      const item = itemsRef.current.find((entry) => entry.key === key);
      if (!item) return;
      if (item.status === 'done' && item.attachment) {
        if (item.bound) {
          setRemovedBoundIds((current) => [...current, item.attachment!.id]);
        } else {
          await deleteMutation.mutateAsync({ id: item.attachment.id });
        }
      }
      setItems((current) => current.filter((entry) => entry.key !== key));
    },
    [deleteMutation]
  );

  const doneAttachments = items.flatMap((item) =>
    item.status === 'done' && item.attachment ? [item] : []
  );

  return {
    items,
    message,
    addFiles,
    retry,
    remove,
    isRemoving: deleteMutation.isPending,
    isUploading: items.some((item) => item.status === 'uploading'),
    /** 제출 시 첨부 개수 (업로드 완료분) */
    count: doneAttachments.length,
    /** 신규(staged) 첨부 id */
    stagedIds: doneAttachments.filter((item) => !item.bound).map((item) => item.attachment!.id),
    removedBoundIds,
    signature: doneAttachments.map((item) => item.key).join(',') + `|${removedBoundIds.join(',')}`
  };
}

export type WorkflowAttachmentsState = ReturnType<typeof useWorkflowAttachments>;

/** 첨부 입력 (dropzone + 목록) — designer §4.7 */
export function WorkflowAttachmentField({
  state,
  required,
  error
}: {
  state: WorkflowAttachmentsState;
  required: boolean;
  error: string | null;
}) {
  const [removeTarget, setRemoveTarget] = useState<WorkflowAttachmentItem | null>(null);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    onDrop: (files) => state.addFiles(files)
  });
  const shownError = error ?? state.message;

  return (
    <div
      data-testid='workflow-field-attachments'
      data-invalid={error ? 'true' : undefined}
      className='flex flex-col gap-2 md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:items-start md:gap-x-6'
    >
      <div className='flex min-h-9 items-center gap-2 text-sm text-muted-foreground'>
        <Icons.paperclip aria-hidden className='size-4' />
        <span className='text-foreground'>첨부파일</span>
        {required ? (
          <span
            data-testid='workflow-attachment-required'
            className='inline-block size-1.5 rounded-full bg-destructive'
          >
            <span className='sr-only'>필수</span>
          </span>
        ) : null}
      </div>
      <div className='flex min-w-0 flex-col gap-2'>
        <div
          {...getRootProps({
            role: 'button',
            tabIndex: 0,
            'aria-label': '첨부파일 추가',
            'aria-invalid': error ? true : undefined
          })}
          data-testid='workflow-attachments-dropzone'
          className={cn(
            'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50',
            isDragActive && 'border-primary bg-primary/5',
            error && 'border-destructive'
          )}
        >
          <input {...getInputProps()} />
          <Icons.upload aria-hidden className='size-4 shrink-0' />
          {/* 휴대폰은 끌어 놓기가 없으므로 「드래그」 문구를 뺀다 */}
          <span className='md:hidden'>파일 추가 (20MB 이하, 최대 30개)</span>
          <span className='max-md:hidden'>파일 추가 혹은 여기로 드래그 (20MB 이하, 최대 30개)</span>
        </div>
        {shownError ? (
          <p data-testid='workflow-attachment-error' role='alert' className='text-sm text-destructive'>
            {shownError}
          </p>
        ) : null}
        {state.items.length > 0 ? (
          <ul className='grid gap-2'>
            {state.items.map((item) => (
              <li
                key={item.key}
                data-testid={item.attachment ? `workflow-attachment-${item.attachment.id}` : undefined}
                className='flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2'
              >
                <WorkflowFileIcon fileName={item.fileName} mimeType={item.mimeType} />
                <span className='flex min-w-0 flex-1 flex-col'>
                  <span className='text-sm break-all'>{item.fileName}</span>
                  <span className='text-xs text-muted-foreground tabular-nums'>
                    {item.status === 'error' ? '업로드 실패' : formatBytes(item.size)}
                  </span>
                </span>
                {item.status === 'uploading' ? (
                  <Spinner aria-label='업로드 중' />
                ) : null}
                {item.status === 'error' && item.file ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-9 shrink-0'
                    onClick={() => state.retry(item.key)}
                  >
                    다시 시도
                  </Button>
                ) : null}
                {item.status !== 'uploading' ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label={`${item.fileName} 삭제`}
                    className='size-9 shrink-0 text-muted-foreground'
                    onClick={() => {
                      if (item.status === 'error') {
                        void state.remove(item.key);
                      } else {
                        setRemoveTarget(item);
                      }
                    }}
                  >
                    <Icons.close aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <AlertModal
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        loading={state.isRemoving}
        title='첨부파일 삭제'
        description={removeTarget ? `"${removeTarget.fileName}" 파일을 삭제합니다.` : ''}
        confirmLabel='삭제'
        cancelLabel='취소'
        onConfirm={() => {
          if (!removeTarget) return;
          state
            .remove(removeTarget.key)
            .then(() => setRemoveTarget(null))
            .catch((removeError: unknown) =>
              notifyError(removeError instanceof Error ? removeError.message : '첨부파일을 삭제하지 못했습니다.')
            );
        }}
      />
    </div>
  );
}
