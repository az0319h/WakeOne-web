'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Icons } from '@/components/icons';
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
import { PageLoadingSpinner } from '@/components/ui/page-loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useNavAccess } from '@/contexts/nav-access';
import { formatAbsoluteDateTimeKo } from '@/lib/format-datetime';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  updateSupportRequestMutation,
  updateSupportStatusMutation
} from '../api/mutations';
import { supportDetailQueryOptions } from '../api/queries';
import {
  SUPPORT_STATUS_LABELS,
  type SupportRequest,
  type SupportStatus
} from '../api/types';
import {
  supportFormSchema,
  type SupportFormValues
} from '../schemas/support-form';
import { SupportStatusBadge } from './support-status-badge';
import { SupportTimestamps } from './support-timestamps';
import { SupportCommentsSection } from './support-comments-section';

const SUPPORT_EDIT_FORM_ID = 'support-request-edit-form';

const ADMIN_STATUS_OPTIONS: Record<SupportStatus, SupportStatus[]> = {
  pending: ['received'],
  received: ['completed'],
  completed: []
};

interface SupportDetailDialogProps {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

function toFormValues(request: { title: string; body: string }): SupportFormValues {
  return {
    title: request.title,
    body: request.body
  };
}

interface SupportDetailUserEditChangeEffectProps {
  hasChanges: boolean;
  onHasChangesChange: (hasChanges: boolean) => void;
}

function SupportDetailUserEditChangeEffect({
  hasChanges,
  onHasChangesChange
}: SupportDetailUserEditChangeEffectProps) {
  useEffect(() => {
    onHasChangesChange(hasChanges);
  }, [hasChanges, onHasChangesChange]);

  return null;
}

interface SupportDetailUserEditSectionProps {
  requestId: number;
  request: Pick<SupportRequest, 'id' | 'title' | 'body' | 'updated_at'>;
  onSaved: () => void;
  onHasChangesChange: (hasChanges: boolean) => void;
  onPendingChange: (isPending: boolean) => void;
}

function SupportDetailUserEditSection({
  requestId,
  request,
  onSaved,
  onHasChangesChange,
  onPendingChange
}: SupportDetailUserEditSectionProps) {
  const { FormTextField, FormTextareaField } = useFormFields<SupportFormValues>();

  const updateMutation = useMutation({
    ...updateSupportRequestMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '문의가 수정되었습니다.');
      onSaved();
    },
    onError: (error) => {
      notifyError(
        error instanceof Error ? error.message : '문의 수정에 실패했습니다.'
      );
    }
  });

  useEffect(() => {
    onPendingChange(updateMutation.isPending);
  }, [updateMutation.isPending, onPendingChange]);

  const form = useAppForm({
    defaultValues: toFormValues(request),
    validators: {
      onSubmit: supportFormSchema
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        id: requestId,
        payload: {
          title: value.title.trim(),
          body: value.body.trim()
        }
      });
    }
  });

  return (
    <form.AppForm>
      <form.Form id={SUPPORT_EDIT_FORM_ID} className='gap-4 p-0 md:p-0'>
        <FormTextField name='title' label='제목' required />
        <FormTextareaField name='body' label='본문' required rows={6} />
      </form.Form>
      <form.Subscribe
        selector={(state) =>
          state.values.title.trim() !== request.title.trim() ||
          state.values.body.trim() !== request.body.trim()
        }
      >
        {(hasChanges) => (
          <SupportDetailUserEditChangeEffect
            hasChanges={hasChanges}
            onHasChangesChange={onHasChangesChange}
          />
        )}
      </form.Subscribe>
    </form.AppForm>
  );
}

export function SupportDetailDialog({
  requestId,
  open,
  onOpenChange,
  isAdmin = false
}: SupportDetailDialogProps) {
  const profile = useNavAccess();
  const { data: request, isPending, isError, refetch } = useQuery({
    ...supportDetailQueryOptions(requestId ?? 0),
    enabled: open && requestId !== null && requestId > 0,
    retry: false
  });

  const [adminStatus, setAdminStatus] = useState<SupportStatus | ''>('');
  const [editHasChanges, setEditHasChanges] = useState(false);
  const [editSavePending, setEditSavePending] = useState(false);

  const statusMutation = useMutation({
    ...updateSupportStatusMutation,
    onSuccess: (response) => {
      notifySuccess(response.message || '상태가 변경되었습니다.');
      void refetch();
    },
    onError: (error) => {
      notifyError(
        error instanceof Error ? error.message : '상태 변경에 실패했습니다.'
      );
    }
  });

  const canUserEdit = !isAdmin && request?.status === 'pending';
  const adminNextStatuses = request ? ADMIN_STATUS_OPTIONS[request.status] : [];
  const showAdminStatusControl = isAdmin && adminNextStatuses.length > 0;

  useEffect(() => {
    if (request) {
      setAdminStatus('');
      setEditHasChanges(false);
      setEditSavePending(false);
    }
  }, [request?.id, request?.status, request?.updated_at]);

  const isSaving = statusMutation.isPending || editSavePending;

  const statusUpdatedLabel = useMemo(() => {
    if (!request?.status_updated_at) {
      return null;
    }
    return formatAbsoluteDateTimeKo(request.status_updated_at);
  }, [request?.status_updated_at]);

  async function handleAdminStatusSave() {
    if (!requestId || !adminStatus || !request) {
      return;
    }

    await statusMutation.mutateAsync({
      id: requestId,
      status: adminStatus
    });
    setAdminStatus('');
  }

  function handleEditSaveClick() {
    const formElement = document.getElementById(SUPPORT_EDIT_FORM_ID) as HTMLFormElement | null;
    formElement?.requestSubmit();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'
        data-testid='support-detail-dialog'
      >
        {isPending ? (
          <div className='p-6'>
            <DialogHeader>
              <DialogTitle>문의 상세</DialogTitle>
            </DialogHeader>
            <PageLoadingSpinner variant='compact' />
          </div>
        ) : isError || !request ? (
          <div className='p-6'>
            <DialogHeader>
              <DialogTitle>문의 상세</DialogTitle>
              <DialogDescription>요청한 문의를 찾을 수 없습니다.</DialogDescription>
            </DialogHeader>
            <div className='text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm'>
              <Icons.help className='size-8 opacity-60' />
              <p data-testid='support-not-found-empty'>문의를 찾을 수 없습니다.</p>
            </div>
            <DialogFooter className='border-t px-6 py-4'>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                닫기
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader className='shrink-0 border-b px-6 pt-6 pb-4'>
              <div className='flex flex-wrap items-center gap-2 pr-8'>
                <DialogTitle className='text-left'>
                  {canUserEdit ? '문의 수정' : request.title}
                </DialogTitle>
                <SupportStatusBadge status={request.status} />
              </div>
              <DialogDescription asChild className='text-left'>
                <div className='space-y-2'>
                  {isAdmin ? (
                    <p className='text-foreground text-sm'>
                      <span className='text-muted-foreground'>제출자 </span>
                      {request.submitter_name}({request.submitter_email})
                    </p>
                  ) : null}
                  <SupportTimestamps
                    createdAt={request.created_at}
                    updatedAt={request.updated_at}
                  />
                  {statusUpdatedLabel ? (
                    <p className='text-muted-foreground font-mono text-xs whitespace-nowrap'>
                      상태 변경 {statusUpdatedLabel}
                    </p>
                  ) : null}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className='min-h-0 flex-1 overflow-y-auto px-6 py-4'>
              <div className='space-y-6'>
                {canUserEdit ? (
                  <SupportDetailUserEditSection
                    key={`${request.id}-${request.updated_at}`}
                    requestId={request.id}
                    request={request}
                    onSaved={() => void refetch()}
                    onHasChangesChange={setEditHasChanges}
                    onPendingChange={setEditSavePending}
                  />
                ) : (
                  <section className='space-y-4'>
                    {!isAdmin ? (
                      <h2 className='text-base font-medium'>{request.title}</h2>
                    ) : null}
                    <div
                      className='text-sm whitespace-pre-wrap'
                      data-testid='support-detail-body'
                    >
                      {request.body}
                    </div>

                    {showAdminStatusControl ? (
                      <section className='space-y-2 border-t pt-4'>
                        <Label htmlFor='support-admin-status'>상태 변경</Label>
                        <Select
                          value={adminStatus}
                          onValueChange={(value) => setAdminStatus(value as SupportStatus)}
                        >
                          <SelectTrigger
                            id='support-admin-status'
                            className='w-full sm:w-56'
                            data-testid='support-admin-status-select'
                          >
                            <SelectValue placeholder='변경할 상태 선택' />
                          </SelectTrigger>
                          <SelectContent>
                            {adminNextStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {SUPPORT_STATUS_LABELS[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </section>
                    ) : null}
                  </section>
                )}

                <SupportCommentsSection
                  request={request}
                  profile={profile}
                  isAdmin={isAdmin}
                  open={open}
                />
              </div>
            </div>

            <DialogFooter className='shrink-0 gap-2 border-t px-6 py-4 sm:justify-end'>
              <Button
                type='button'
                variant='outline'
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                닫기
              </Button>
              {canUserEdit ? (
                <Button
                  type='button'
                  disabled={!editHasChanges || isSaving}
                  isLoading={editSavePending}
                  onClick={handleEditSaveClick}
                >
                  저장
                </Button>
              ) : null}
              {!canUserEdit && showAdminStatusControl ? (
                <Button
                  type='button'
                  disabled={!adminStatus || statusMutation.isPending}
                  isLoading={statusMutation.isPending}
                  onClick={() => void handleAdminStatusSave()}
                  data-testid='support-admin-status-save'
                >
                  상태 저장
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
