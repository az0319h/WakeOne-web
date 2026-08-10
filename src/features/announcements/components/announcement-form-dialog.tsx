'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatBytes } from '@/lib/utils';
import {
  createAnnouncementMutation,
  notifyAnnouncementPublishedMutation,
  updateAnnouncementMutation,
  uploadAnnouncementAttachmentMutation
} from '../api/mutations';
import { announcementDetailQueryOptions } from '../api/queries';
import {
  ANNOUNCEMENT_ATTACHMENT_LIMIT_HINT,
  ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_BYTES,
  ANNOUNCEMENT_ATTACHMENT_PER_FILE_SIZE_ERROR,
  ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_BYTES,
  ANNOUNCEMENT_ATTACHMENT_TOTAL_SIZE_ERROR,
  ANNOUNCEMENT_PRIORITIES,
  type Announcement
} from '../api/types';
import { AnnouncementAttachmentList } from './announcement-attachment-list';

const announcementFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '제목을 입력해 주세요.')
    .max(120, '제목은 120자 이하여야 합니다.'),
  body: z
    .string()
    .trim()
    .min(1, '본문을 입력해 주세요.')
    .max(5000, '본문은 5000자 이하여야 합니다.'),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES),
  is_pinned: z.boolean()
});

type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;

const CREATE_EMPTY_DEFAULT_VALUES: AnnouncementFormValues = {
  title: '',
  body: '',
  priority: 'normal',
  is_pinned: false
};

const PRIORITY_OPTIONS = [
  { value: 'normal', label: '일반' },
  { value: 'important', label: '중요' },
  { value: 'urgent', label: '긴급' }
];

interface AnnouncementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  editAnnouncementId?: number | null;
  onSuccess?: () => void;
}

function toFormValues(announcement: Announcement): AnnouncementFormValues {
  return {
    title: announcement.title,
    body: announcement.body,
    priority: announcement.priority,
    is_pinned: announcement.is_pinned
  };
}

export function AnnouncementFormDialog({
  open,
  onOpenChange,
  mode,
  editAnnouncementId,
  onSuccess
}: AnnouncementFormDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const { data: editAnnouncement, isPending: isEditLoading } = useQuery({
    ...announcementDetailQueryOptions(editAnnouncementId ?? 0),
    enabled: open && mode === 'edit' && Boolean(editAnnouncementId)
  });

  const displayAnnouncement = editAnnouncement ?? null;

  const createMutation = useMutation(createAnnouncementMutation);
  const updateMutation = useMutation(updateAnnouncementMutation);
  const uploadMutation = useMutation(uploadAnnouncementAttachmentMutation);
  const notifyMutation = useMutation(notifyAnnouncementPublishedMutation);

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadMutation.isPending ||
    notifyMutation.isPending;

  const { FormTextField, FormTextareaField, FormSelectField, FormSwitchField } =
    useFormFields<AnnouncementFormValues>();

  const form = useAppForm({
    defaultValues:
      mode === 'edit' && editAnnouncement
        ? toFormValues(editAnnouncement)
        : CREATE_EMPTY_DEFAULT_VALUES,
    validators: {
      onSubmit: announcementFormSchema
    },
    onSubmit: async ({ value }) => {
      try {
        if (mode === 'create') {
          const hasFiles = selectedFiles.length > 0;
          const createResponse = await createMutation.mutateAsync({
            title: value.title.trim(),
            body: value.body.trim(),
            priority: value.priority,
            is_pinned: value.is_pinned,
            defer_notify: hasFiles
          });

          const announcementId = createResponse.announcement.id;

          for (let index = 0; index < selectedFiles.length; index += 1) {
            const file = selectedFiles[index];
            try {
              await uploadMutation.mutateAsync({ announcementId, file });
            } catch (error) {
              const message =
                error instanceof Error
                  ? `"${file.name}" 업로드 실패: ${error.message}`
                  : `"${file.name}" 업로드에 실패했습니다.`;
              notifyError(message);
              setSelectedFiles(selectedFiles.slice(index));
              return;
            }
          }

          if (hasFiles) {
            await notifyMutation.mutateAsync(announcementId);
          }

          notifySuccess(createResponse.message);
          form.reset(CREATE_EMPTY_DEFAULT_VALUES);
          setSelectedFiles([]);
          onOpenChange(false);
          router.refresh();
          onSuccess?.();
          return;
        }

        if (!editAnnouncement || !editAnnouncementId) {
          return;
        }

        const updateResponse = await updateMutation.mutateAsync({
          id: editAnnouncementId,
          payload: {
            title: value.title.trim(),
            body: value.body.trim(),
            priority: value.priority,
            is_pinned: value.is_pinned
          }
        });

        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];
          try {
            await uploadMutation.mutateAsync({
              announcementId: editAnnouncementId,
              file
            });
          } catch (error) {
            const message =
              error instanceof Error
                ? `"${file.name}" 업로드 실패: ${error.message}`
                : `"${file.name}" 업로드에 실패했습니다.`;
            notifyError(message);
            setSelectedFiles(selectedFiles.slice(index));
            return;
          }
        }

        notifySuccess(updateResponse.message);
        form.reset(toFormValues(updateResponse.announcement));
        setSelectedFiles([]);
        onOpenChange(false);
        router.refresh();
        onSuccess?.();
      } catch (error) {
        notifyError(
          error instanceof Error ? error.message : '공지 저장에 실패했습니다.'
        );
      }
    }
  });

  useEffect(() => {
    if (open) {
      setSelectedFiles([]);
    }
  }, [open, editAnnouncementId]);

  useEffect(() => {
    if (open && mode === 'edit' && editAnnouncement) {
      form.reset(toFormValues(editAnnouncement));
    }
  }, [open, mode, editAnnouncement, form]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isSaving) {
      if (mode === 'create') {
        form.reset(CREATE_EMPTY_DEFAULT_VALUES);
      } else if (editAnnouncement) {
        form.reset(toFormValues(editAnnouncement));
      }
      setSelectedFiles([]);
    }
    onOpenChange(nextOpen);
  }

  function getExistingTotalSize() {
    return (displayAnnouncement?.attachments ?? []).reduce(
      (total, attachment) => total + attachment.file_size,
      0
    );
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const existingFileNames = new Set(
      (displayAnnouncement?.attachments ?? []).map((attachment) => attachment.file_name)
    );
    const selectedFileNames = new Set(selectedFiles.map((file) => file.name));
    const incomingFileNames = new Set<string>();

    const duplicatedFile = files.find((file) => {
      const isDuplicated =
        existingFileNames.has(file.name) ||
        selectedFileNames.has(file.name) ||
        incomingFileNames.has(file.name);
      incomingFileNames.add(file.name);
      return isDuplicated;
    });

    if (duplicatedFile) {
      notifyError(`"${duplicatedFile.name}" 파일명이 이미 존재합니다.`);
      event.target.value = '';
      return;
    }

    const oversizedFile = files.find(
      (file) => file.size > ANNOUNCEMENT_ATTACHMENT_PER_FILE_MAX_BYTES
    );
    if (oversizedFile) {
      notifyError(
        `"${oversizedFile.name}" (${formatBytes(oversizedFile.size)}): ${ANNOUNCEMENT_ATTACHMENT_PER_FILE_SIZE_ERROR}`
      );
      event.target.value = '';
      return;
    }

    const nextFiles = [...selectedFiles, ...files];
    const selectedTotalSize = nextFiles.reduce((total, file) => total + file.size, 0);
    const nextTotalSize = getExistingTotalSize() + selectedTotalSize;

    if (nextTotalSize > ANNOUNCEMENT_ATTACHMENT_TOTAL_MAX_BYTES) {
      notifyError(
        `${ANNOUNCEMENT_ATTACHMENT_TOTAL_SIZE_ERROR} (현재 ${formatBytes(nextTotalSize)})`
      );
      event.target.value = '';
      return;
    }

    setSelectedFiles(nextFiles);
    event.target.value = '';
  }

  function handleRemoveSelectedFile(index: number) {
    setSelectedFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className='flex max-h-[90vh] flex-col sm:max-w-2xl'
        data-testid='announcement-form-dialog'
      >
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '공지 작성' : '공지 수정'}</DialogTitle>
        </DialogHeader>

        {mode === 'edit' && isEditLoading ? (
          <PageLoadingSpinner variant='compact' />
        ) : (
          <form.AppForm>
          <form.Form className='flex min-h-0 flex-1 flex-col p-0'>
            <div className='flex-1 space-y-4 overflow-y-auto px-1'>
              <FormTextField name='title' label='제목' required placeholder='공지 제목' />
              <FormTextareaField
                name='body'
                label='본문'
                required
                rows={8}
                placeholder='공지 내용을 입력하세요.'
              />
              <FormSelectField
                name='priority'
                label='우선순위'
                options={PRIORITY_OPTIONS}
                placeholder='우선순위 선택'
              />
              <FormSwitchField
                name='is_pinned'
                label='상단 고정'
                description='고정 공지는 최대 3개까지 등록할 수 있습니다.'
              />

            <section className='space-y-3 border-t pt-4'>
              <div>
                <h3 className='text-sm font-medium'>첨부파일</h3>
                <p className='text-muted-foreground mt-1 whitespace-pre-line text-xs'>
                  {ANNOUNCEMENT_ATTACHMENT_LIMIT_HINT}
                </p>
              </div>

              <input
                ref={fileInputRef}
                type='file'
                multiple
                className='hidden'
                onChange={handleFileChange}
              />
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={isSaving}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icons.upload className='mr-2 h-4 w-4' />
                파일 선택
              </Button>

              {selectedFiles.length > 0 ? (
                <div className='space-y-2'>
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className='flex items-center justify-between gap-2 rounded-md border p-3'
                    >
                      <div className='min-w-0'>
                        <div className='flex items-center gap-2'>
                          <Icons.paperclip className='h-4 w-4 shrink-0' />
                          <span className='truncate text-sm font-medium'>{file.name}</span>
                          <Badge variant='outline' className='shrink-0'>
                            저장 대기
                          </Badge>
                        </div>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {formatBytes(file.size)}
                        </p>
                      </div>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        disabled={isSaving}
                        aria-label={`${file.name} 선택 취소`}
                        onClick={() => handleRemoveSelectedFile(index)}
                      >
                        <Icons.trash className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              {mode === 'edit' && displayAnnouncement ? (
                <AnnouncementAttachmentList
                  announcementId={displayAnnouncement.id}
                  attachments={displayAnnouncement.attachments ?? []}
                  canDelete
                />
              ) : null}
            </section>
          </div>

            <DialogFooter className='mt-4 gap-2 border-t pt-4'>
              <Button
                type='button'
                variant='outline'
                disabled={isSaving}
                onClick={() => handleOpenChange(false)}
              >
                취소
              </Button>
              <Button type='submit' isLoading={isSaving} disabled={mode === 'edit' && isEditLoading}>
                저장
              </Button>
            </DialogFooter>
          </form.Form>
        </form.AppForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
