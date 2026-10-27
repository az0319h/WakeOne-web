'use client';

import { useStore } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useAppForm } from '@/components/ui/tanstack-form';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  createQuickRequestNoteMutation,
  updateQuickRequestNoteMutation
} from '../api/mutations';
import type { QuickRequestNote } from '../api/types';
import {
  QUICK_REQUEST_NOTE_LABEL_MAX_LENGTH,
  quickRequestNoteLabelSchema
} from '../schemas/quick-request-note';

const noteEditorSchema = z.object({ label: quickRequestNoteLabelSchema });

export type QuickRequestNoteEditorTarget = { mode: 'create' } | { mode: 'edit'; note: QuickRequestNote };

type QuickRequestNoteEditorFormProps = {
  target: QuickRequestNoteEditorTarget;
  onClose: () => void;
  /** PATCH 성공 시 폼 선택값 치환용 */
  onUpdated: (previousLabel: string, nextLabel: string) => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '처리 중 오류가 발생했습니다.';
}

function QuickRequestNoteEditorForm({ target, onClose, onUpdated }: QuickRequestNoteEditorFormProps) {
  const createMutation = useMutation({
    ...createQuickRequestNoteMutation,
    onSuccess: () => {
      notifySuccess('특이사항이 추가되었습니다.');
    },
    onError: (error) => notifyError(errorMessage(error))
  });

  const updateMutation = useMutation({
    ...updateQuickRequestNoteMutation,
    onSuccess: (data) => {
      onUpdated(data.previousLabel, data.note.label);
      notifySuccess('특이사항이 수정되었습니다.');
    },
    onError: (error) => notifyError(errorMessage(error))
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useAppForm({
    defaultValues: { label: target.mode === 'edit' ? target.note.label : '' },
    validators: { onSubmit: noteEditorSchema },
    onSubmit: async ({ value, formApi }) => {
      const label = value.label.trim();
      try {
        if (target.mode === 'edit') {
          await updateMutation.mutateAsync({ id: target.note.id, payload: { label } });
        } else {
          await createMutation.mutateAsync({ label });
        }
      } catch {
        // 실패: 서버 message toast(onError) · Dialog와 입력값 유지
        return;
      }
      formApi.reset();
      onClose();
    }
  });

  const length = useStore(form.store, (s) => s.values.label.length);

  return (
    <form.AppForm>
      <form.Form className='grid gap-4 p-0 md:p-0'>
        <div className='grid gap-1'>
          <form.AppField name='label'>
            {(field) => (
              <field.TextField
                label='특이사항'
                required
                placeholder='예: 엘리베이터 없음…'
                autoComplete='off'
                autoFocus
                maxLength={QUICK_REQUEST_NOTE_LABEL_MAX_LENGTH}
                disabled={isPending}
                className='h-11'
                data-testid='quick-request-note-editor-input'
              />
            )}
          </form.AppField>
          <p aria-live='polite' className='text-right text-xs text-muted-foreground tabular-nums'>
            {length}/{QUICK_REQUEST_NOTE_LABEL_MAX_LENGTH}
          </p>
        </div>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            className='h-11'
            disabled={isPending}
            onClick={onClose}
          >
            취소
          </Button>
          <form.SubmitButton className='h-11' data-testid='quick-request-note-editor-save'>
            저장
          </form.SubmitButton>
        </DialogFooter>
      </form.Form>
    </form.AppForm>
  );
}

type QuickRequestNoteEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: QuickRequestNoteEditorTarget;
  /** 열 때마다 바뀌는 값 — 폼을 새 기본값으로 다시 만든다 */
  sessionKey: number;
  onUpdated: (previousLabel: string, nextLabel: string) => void;
};

/** 특이사항 칩 추가·수정 Dialog — 성공 시에만 reset·닫기 */
export function QuickRequestNoteEditorDialog({
  open,
  onOpenChange,
  target,
  sessionKey,
  onUpdated
}: QuickRequestNoteEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{target.mode === 'edit' ? '특이사항 수정' : '특이사항 추가'}</DialogTitle>
          <DialogDescription>출발지·도착지 특이사항 목록에 함께 표시됩니다.</DialogDescription>
        </DialogHeader>
        <QuickRequestNoteEditorForm
          key={sessionKey}
          target={target}
          onClose={() => onOpenChange(false)}
          onUpdated={onUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}
